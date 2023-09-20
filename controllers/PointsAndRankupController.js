import fs from "fs";
import path from "path";
import Papa from "papaparse";
import url from "url";
import { ErrorHandler } from "../utils/errorHandler.js";
import { catchAsyncError } from "../middleware/catchAsyncError.js";
import PointsAndRankup from "../models/pointsAndRankupReport-model.js";


import { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand, } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../middleware/awsConfig.js"

const filterData = (data, month) => {
    // const currentMonth = new Date().getMonth() + 1; // Get the current month (1 to 12)
    const currentMonth = month
    // Filter the data to include only rows where OrderIDList column doesn't contain "Declined" or "Cancelled",
    // is not blank, and has the current month
    return data.filter((row) => {
        const orderIdList = row['OrderIDList'] ?? ''; // Set orderIdList to an empty string if it's undefined
        const hasDeclinedOrCancelled = orderIdList.includes('Declined') || orderIdList.includes('Cancelled');
        const isBlank = orderIdList.trim() === ''; // Check if the OrderIDList column is blank
        const monthMatch = orderIdList.includes(`, ${currentMonth}/`); // Check if the orderIdList contains the current month

        return !hasDeclinedOrCancelled && !isBlank && monthMatch;
    });
};


const totalOrders = (data) => {
    // Filter the data to include only rows where PV is a valid number and not 0
    return data.filter((row) => parseInt(row.PersonalVolume, 10) > 0);
};



const filterDataForCcReport = (data, month) => {
    const currentMonth = month;
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;

    return data.filter((row) => {
        const orderIdList = row['OrderIDList'] || ''; // Set orderIdList to an empty string if it's undefined
        const nextAutoOrder = row['NextAutoOrder'] || '';
        const hasDeclinedOrCancelled = orderIdList.includes('Declined') || orderIdList.includes('Cancelled');

        // Check if the row matches the condition for suspectedSubsDeclinedLastMonth
        const isSuspectedSubsDeclinedLastMonth =
            nextAutoOrder !== '' &&
            nextAutoOrder.includes(`${previousMonth}/`) &&
            orderIdList.includes(`, ${previousMonth}/`) &&
            hasDeclinedOrCancelled;

        // Check if the row matches the condition for suspectedSubsDeclinedThisMonth
        const isSuspectedSubsDeclinedThisMonth =
            nextAutoOrder !== '' &&
            (nextAutoOrder.includes(`${currentMonth}/`) || nextAutoOrder.includes(`${currentMonth + 1}/`)) &&
            orderIdList.includes(`, ${currentMonth}/`) &&
            hasDeclinedOrCancelled;

        // Include the row in the filtered data if it matches either of the conditions
        return isSuspectedSubsDeclinedLastMonth || isSuspectedSubsDeclinedThisMonth;
    });
};

const calculateCreditCardDeclineRate = (data, month) => {
    const currentMonth = Number(month);
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;

    let totalProceedThisMonth = 0;
    let subsDeclineThisMonth = 0;
    let subsDeclineLastMonth = 0;

    data.forEach((item) => {
        const orderIdList = item.OrderIDList || '';
        const nextAutoOrder = item.NextAutoOrder || '';
        const hasDeclinedOrCancelled = orderIdList.includes('Declined') || orderIdList.includes('Cancelled');

        if ((orderIdList.includes('Shipped') || orderIdList.includes('Pending') || orderIdList.includes('Printed') || orderIdList.includes('Accepted'))) {
            totalProceedThisMonth++;
        }

        if (nextAutoOrder !== '' && hasDeclinedOrCancelled) {
            subsDeclineLastMonth++;
        }

        if (
            nextAutoOrder !== '' &&
            (nextAutoOrder.includes(`${currentMonth}/`) || nextAutoOrder.includes(`${currentMonth + 1}/`)) &&
            hasDeclinedOrCancelled
        ) {
            subsDeclineThisMonth++;
        }


    });

    return {
        totalProceedThisMonth,
        subsDeclineThisMonth,
        subsDeclineLastMonth,
    };
};

// Start Points par Leg..................................

const calculateLevel1Legs = (data) => {
    let level1Count = 0;
    let prevLevel1Leg = 0;
    const legNamesMap = new Map();

    const dataForLegs = data.map((item) => {
        if (item.Level === '1') {
            level1Count++;
        }

        const level1Leg = item.Level === '1' ? level1Count : 0;

        // Calculate the leg based on level1Leg, and if level1Leg is 0, use the previous level1Leg that is not 0
        const leg = level1Leg !== 0 ? level1Leg : prevLevel1Leg;

        // Update the prevLevel1Leg for the next iteration if level1Leg is not 0
        if (level1Leg !== 0) {
            prevLevel1Leg = level1Leg;
        }

        let legName = '';

        if (leg !== 0) {
            if (!legNamesMap.has(leg)) {
                legNamesMap.set(leg, {
                    firstName: item.FirstName,
                    lastName: item.LastName, // Include LastName in the legName Map value
                });
            }

            const legNameData = legNamesMap.get(leg);
            legName = `${legNameData.firstName} ${legNameData.lastName}`; // Combine FirstName and LastName
        }

        return {
            FirstName: item.FirstName,
            LastName: item.LastName,
            CustomerType: item.CustomerType,
            Level: item.Level,
            PlexusPointsInOrganization: !item.PlexusPointsInOrganization ? 0 : Number(item.PlexusPointsInOrganization),
            Level1Leg: level1Leg,
            Leg: leg,
            LegName: legName,
        };
    });

    return dataForLegs;
};

// End Points par Leg

// Start Fully CompressedPoints(CurrentMonth) and for lastMoth it is Average Compression Bonus..........................................
// const calculateFullyCompressedPoints = (data) => {
//     let fullyCompressedPts = 0;
//     let pointsGainedThisMonthWithoutSubscription = 0;
//     let newVipsTotal = 0;
//     let pointsFromNewVips = 0;
//     let ptsWorthForRetention = {};
//     let recordedThisMonthForRetention = {};

//     // Get current month and year
//     const currentDate = new Date();
//     const currentMonth = currentDate.getMonth() + 1; // Month is zero-indexed
//     const currentYear = currentDate.getFullYear();

//     data?.forEach((item) => {
//         const plexusPoints = parseFloat(item.PlexusPointsInOrganization) || 0;
//         const paidLevel = parseInt(item.PaidLevel, 10) || 0;
//         const Level = parseInt(item.Level, 10) || 0;
//         const createdDate = item.CreatedDate;

//         const PL100Above = calculatePL100Above(paidLevel);
//         const PL50_99 = calculatePL50_99(paidLevel);
//         const PL25_49 = calculatePL25_49(paidLevel);
//         let compressedPts = 0;

//         if (plexusPoints === 0) {
//             compressedPts = 0;
//         } else if (plexusPoints === PL100Above) {
//             compressedPts = calculatePV100Above(Level);
//         } else if (plexusPoints === PL50_99) {
//             compressedPts = calculatePV50_99(Level);
//         } else if (plexusPoints === PL25_49) {
//             compressedPts = calculatePV25_49(Level);
//         }

//         fullyCompressedPts += compressedPts;

//         const nextAutoOrder = item.NextAutoOrder;
//         const customerType = item.CustomerType;

//         if (!nextAutoOrder) {
//             pointsGainedThisMonthWithoutSubscription += compressedPts;
//         }

//         if (Level < 8 ) {
//             let createdDateParts;
//             let dayIndex, monthIndex;

//             if (createdDate.includes("-")) {
//                 createdDateParts = createdDate.split("-");
//                 dayIndex = 0;
//                 monthIndex = 1;
//             } else if (createdDate.includes("/")) {
//                 createdDateParts = createdDate.split("/");
//                 dayIndex = 1;
//                 monthIndex = 0;
//             } else {
//                 console.error("Invalid CreatedDate format:", createdDate);
//                 // Handle invalid format if needed
//                 return;
//             }

//             const createdMonth = parseInt(createdDateParts[monthIndex], 10);
//             const createdYear = parseInt(createdDateParts[2], 10);

//             if (createdMonth === currentMonth && createdYear === currentYear) {
//                 newVipsTotal += 1;
//                 pointsFromNewVips += compressedPts;
//             }
//         }

//         if (createdDate) {
//             let createdDateParts;
//             let dayIndex, monthIndex;

//             if (createdDate.includes("-")) {
//                 createdDateParts = createdDate.split("-");
//                 dayIndex = 0;
//                 monthIndex = 1;
//             } else if (createdDate.includes("/")) {
//                 createdDateParts = createdDate.split("/");
//                 dayIndex = 1;
//                 monthIndex = 0;
//             } else {
//                 console.error("Invalid CreatedDate format:", createdDate);
//                 // Handle invalid format if needed
//                 return;
//             }

//             const createdMonth = parseInt(createdDateParts[monthIndex], 10);
//             const createdYear = parseInt(createdDateParts[2], 10);

//             if (createdYear === currentYear) {
//                 recordedThisMonthForRetention[createdMonth] = (recordedThisMonthForRetention[createdMonth] || 0) + compressedPts;
//             }
//         }

//         if (createdDate) {
//             let createdDateParts;
//             let dayIndex, monthIndex;

//             if (createdDate.includes("-")) {
//                 createdDateParts = createdDate.split("-");
//                 dayIndex = 0;
//                 monthIndex = 1;
//             } else if (createdDate.includes("/")) {
//                 createdDateParts = createdDate.split("/");
//                 dayIndex = 1;
//                 monthIndex = 0;
//             } else {
//                 console.error("Invalid CreatedDate format:", createdDate);
//                 // Handle invalid format if needed
//                 return;
//             }

//             const createdMonth = parseInt(createdDateParts[monthIndex], 10);
//             const createdYear = parseInt(createdDateParts[2], 10);

//             if (createdYear === currentYear) {
//                 const pv100AbovePoints = calculatePV100Above(Level);
//                 ptsWorthForRetention[createdMonth] = (ptsWorthForRetention[createdMonth] || 0) + pv100AbovePoints;
//             }
//         }
//     });
// console.log("recordedThisMonthForRetention"+recordedThisMonthForRetention)
//     return {
//         fullyCompressedPts,
//         pointsGainedThisMonthWithoutSubscription,
//         newVipsTotal,
//         pointsFromNewVips,
//         ptsWorthForRetention,
//         recordedThisMonthForRetention,
//     };
// };


const calculateFullyCompressedPoints = (data) => {
    let fullyCompressedPts = 0;
    let pointsGainedThisMonthWithoutSubscription = 0;
    let newVipsTotal = 0;
    let pointsFromNewVips = 0;
    let ptsWorthForRetention = {};
    let recordedThisMonthForRetention = {};

    // Get current month and year
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // Month is zero-indexed
    const currentYear = currentDate.getFullYear();

    data?.forEach((item) => {
        const plexusPoints = parseFloat(item.PlexusPointsInOrganization) || 0;
        const paidLevel = parseInt(item.PaidLevel, 10) || 0;
        const Level = parseInt(item.Level, 10) || 0;
        const createdDate = item.CreatedDate;

        const PL100Above = calculatePL100Above(paidLevel);
        const PL50_99 = calculatePL50_99(paidLevel);
        const PL25_49 = calculatePL25_49(paidLevel);
        let compressedPts = 0;

        if (plexusPoints === 0) {
            compressedPts = 0;
        } else if (plexusPoints === PL100Above) {
            compressedPts = calculatePV100Above(Level);
        } else if (plexusPoints === PL50_99) {
            compressedPts = calculatePV50_99(Level);
        } else if (plexusPoints === PL25_49) {
            compressedPts = calculatePV25_49(Level);
        }

        fullyCompressedPts += compressedPts;

        const nextAutoOrder = item.NextAutoOrder;
        const customerType = item.CustomerType;

        if (!nextAutoOrder) {
            pointsGainedThisMonthWithoutSubscription += compressedPts;
        }

     if (Level < 8) {
            let dateComponents;
            
            // Check if createdDate is not null and is defined
            if (createdDate && typeof createdDate === 'string') {
                if (createdDate.includes('/')) {
                    dateComponents = createdDate.match(/(\d+)\/(\d+)\/(\d+)/);
                } else if (createdDate.includes('-')) {
                    dateComponents = createdDate.match(/(\d+)-(\d+)-(\d+)/);
                }
            }

            if (dateComponents) {
                let [, month = '', day = '', year = ''] = dateComponents;
                // Check if the format is MM/DD/YYYY (with /) or DD-MM-YYYY (with -) and parse accordingly
                if (createdDate.includes('/')) {
                    [, month = '', day = '', year = ''] = dateComponents;
                } else {
                    [, day = '', month = '', year = ''] = dateComponents;
                }

                const createdMonth = parseInt(month, 10);
                const createdYear = parseInt(year, 10);

                if (createdMonth === currentMonth && createdYear === currentYear) {
                    newVipsTotal += 1;
                    pointsFromNewVips += compressedPts;
                }
            }
        }

        if (createdDate) {
            let dateComponents;
            // Check for the date format using a regular expression
            if (createdDate.includes('/')) {
                dateComponents = createdDate.match(/(\d+)\/(\d+)\/(\d+)/);
            } else if (createdDate.includes('-')) {
                dateComponents = createdDate.match(/(\d+)-(\d+)-(\d+)/);
            }

            if (dateComponents) {
                let [, month = '', day = '', year = ''] = dateComponents;
                // Check if the format is MM/DD/YYYY (with /) or DD-MM-YYYY (with -) and parse accordingly
                if (createdDate.includes('/')) {
                    [, month = '', day = '', year = ''] = dateComponents;
                } else {
                    [, day = '', month = '', year = ''] = dateComponents;
                }

                const createdMonth = parseInt(month, 10);
                const createdYear = parseInt(year, 10);

                if (createdYear === currentYear) {
                    recordedThisMonthForRetention[createdMonth] = (recordedThisMonthForRetention[createdMonth] || 0) + compressedPts;
                }
            }
        }

        if (createdDate) {
            let dateComponents;
            // Check for the date format using a regular expression
            if (createdDate.includes('/')) {
                dateComponents = createdDate.match(/(\d+)\/(\d+)\/(\d+)/);
            } else if (createdDate.includes('-')) {
                dateComponents = createdDate.match(/(\d+)-(\d+)-(\d+)/);
            }

            if (dateComponents) {
                let [, month = '', day = '', year = ''] = dateComponents;
                // Check if the format is MM/DD/YYYY (with /) or DD-MM-YYYY (with -) and parse accordingly
                if (createdDate.includes('/')) {
                    [, month = '', day = '', year = ''] = dateComponents;
                } else {
                    [, day = '', month = '', year = ''] = dateComponents;
                }

                const createdMonth = parseInt(month, 10);
                const createdYear = parseInt(year, 10);

                if (createdYear === currentYear) {
                    const pv100AbovePoints = calculatePV100Above(Level);
                    ptsWorthForRetention[createdMonth] = (ptsWorthForRetention[createdMonth] || 0) + pv100AbovePoints;
                }
            }
        }
    });

    console.log("recordedThisMonthForRetention", recordedThisMonthForRetention);

    return {
        fullyCompressedPts,
        pointsGainedThisMonthWithoutSubscription,
        newVipsTotal,
        pointsFromNewVips,
        ptsWorthForRetention,
        recordedThisMonthForRetention,
    };
};




const sumOfTotalPlexusPoints = (data) => {
    let sumOfPlexusPoints = 0; // Initialize the sum to 0

    data.forEach((item) => {
        const plexusPoints = parseFloat(item.PlexusPointsInOrganization) || 0;
        sumOfPlexusPoints += plexusPoints; // Add current plexusPoints to the sum
    });

    return sumOfPlexusPoints; // Return the sum
};


// const lastMonthVips = (data) => {
//     let lastMonthVipsTotal = 0; // Initialize the count to 0
//     let lastMonthPointsFromNewVips = 0; // Initialize the sum to 0
//     let orderedLastMonthForRetention = {}

//     const currentDate = new Date();
//     const currentMonth = currentDate.getMonth() + 1; // Month is zero-indexed
//     const currentYear = currentDate.getFullYear();

//     data.forEach((item) => {
//         const plexusPoints = parseFloat(item.PlexusPointsInOrganization) || 0;
//         const level = parseInt(item.Level, 10) || 0;
//         const createdDate = item.CreatedDate;
//         const customerType = item.CustomerType;

//         if (customerType === "VIP Customer") {
//             const createdDateParts = createdDate.split(/[/-]/);
//             const createdMonth = parseInt(createdDateParts[1], 10);
//             const createdYear = parseInt(createdDateParts[2], 10);

//             if (createdMonth === currentMonth - 1 && createdYear === currentYear) {
//                 lastMonthVipsTotal += 1;
//                 lastMonthPointsFromNewVips += plexusPoints;
//             }
//         }
//         if (createdDate) {  // Check if createdDate is defined before splitting
//             const createdDateParts = createdDate.split(/[/-]/);
//             const createdMonth = parseInt(createdDateParts[1], 10);
//             const createdYear = parseInt(createdDateParts[2], 10);

//             if (createdYear === currentYear) {
//                 orderedLastMonthForRetention[createdMonth] = (orderedLastMonthForRetention[createdMonth] || 0) + plexusPoints;
//             }
//         }

//     });

//     return { lastMonthVipsTotal, lastMonthPointsFromNewVips, orderedLastMonthForRetention };
// };

const lastMonthVips = (data) => {
    let lastMonthVipsTotal = 0; // Initialize the count to 0
    let lastMonthPointsFromNewVips = 0; // Initialize the sum to 0
    let orderedLastMonthForRetention = {};

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // Month is zero-indexed
    const currentYear = currentDate.getFullYear();

    data.forEach((item) => {
        const plexusPoints = parseFloat(item.PlexusPointsInOrganization) || 0;
        const level = parseInt(item.Level, 10) || 0;
        const createdDate = item.CreatedDate;
        const customerType = item.CustomerType;

        if (typeof createdDate === 'string') {
            let dateComponents;
            // Check for the date format using a regular expression
            if (createdDate.includes('/')) {
                dateComponents = createdDate.match(/(\d+)\/(\d+)\/(\d+)/);
            } else if (createdDate.includes('-')) {
                dateComponents = createdDate.match(/(\d+)-(\d+)-(\d+)/);
            }

            if (dateComponents) {
                let [, month = '', day = '', year = ''] = dateComponents;
                // Check if the format is MM/DD/YYYY (with /) or DD-MM-YYYY (with -) and parse accordingly
                if (createdDate.includes('/')) {
                    [, month = '', day = '', year = ''] = dateComponents;
                } else {
                    [, day = '', month = '', year = ''] = dateComponents;
                }

                const createdMonth = parseInt(month, 10);
                const createdYear = parseInt(year, 10);

                if (createdMonth === currentMonth - 1 && createdYear === currentYear) {
                    lastMonthVipsTotal += 1;
                    lastMonthPointsFromNewVips += plexusPoints;
                }
            }
        }

        if (createdDate) {
            let dateComponents;
            // Check for the date format using a regular expression
            if (createdDate.includes('/')) {
                dateComponents = createdDate.match(/(\d+)\/(\d+)\/(\d+)/);
            } else if (createdDate.includes('-')) {
                dateComponents = createdDate.match(/(\d+)-(\d+)-(\d+)/);
            }

            if (dateComponents) {
                let [, month = '', day = '', year = ''] = dateComponents;
                // Check if the format is MM/DD/YYYY (with /) or DD-MM-YYYY (with -) and parse accordingly
                if (createdDate.includes('/')) {
                    [, month = '', day = '', year = ''] = dateComponents;
                } else {
                    [, day = '', month = '', year = ''] = dateComponents;
                }

                const createdMonth = parseInt(month, 10);
                const createdYear = parseInt(year, 10);

                if (createdYear === currentYear) {
                    orderedLastMonthForRetention[createdMonth] = (orderedLastMonthForRetention[createdMonth] || 0) + plexusPoints;
                }
            }
        }
    });

    return { lastMonthVipsTotal, lastMonthPointsFromNewVips, orderedLastMonthForRetention };
};






const calculatePL100Above = (paidLevel) => {
    if (paidLevel === 1) return 6;
    if (paidLevel === 2) return 5;
    if (paidLevel === 3) return 5;
    if (paidLevel === 4) return 4;
    if (paidLevel === 5) return 3;
    if (paidLevel === 6) return 2;
    if (paidLevel === 7) return 1;
    return 0;
};
const calculatePV100Above = (Level) => {
    if (Level === 1) return 6;
    if (Level === 1) return 6;
    if (Level === 2) return 5;
    if (Level === 3) return 5;
    if (Level === 4) return 4;
    if (Level === 5) return 3;
    if (Level === 6) return 2;
    if (Level === 7) return 1;
    return 0;
};

const calculatePL50_99 = (paidLevel) => {
    if (paidLevel === 0) return 0;
    if (paidLevel === 1) return 4;
    if (paidLevel < 5) return 2;
    if (paidLevel < 8) return 1;
    return 0;
};
const calculatePV50_99 = (Level) => {
    if (Level === 0) return 0;
    if (Level === 1) return 4;
    if (Level < 5) return 2;
    if (Level < 8) return 1;
    return 0;
};

const calculatePL25_49 = (paidLevel) => {
    if (paidLevel === 0) return 0;
    if (paidLevel === 1) return 2;
    if (paidLevel < 7) return 1;
    return 0;
};
const calculatePV25_49 = (Level) => {
    if (Level === 0) return 0;
    if (Level === 1) return 2;
    if (Level < 7) return 1;
    return 0;
};

// End FullyCompressedPoints............................................


// Calculate PointsFromSubscription
// Calculate PVAfterSub
const calculatePVAfterSub = (item, month) => {
    // const curMonth = Number(month) + 1; // Current month
    const curMonth = new Date().getMonth() + 1; // Current month
    const nextAutoOrder = item.NextAutoOrder || ''; // NextAutoOrder value from CSV

    if (nextAutoOrder) {
        const parts = nextAutoOrder.split(',');
        if (parts.length === 3) {
            const subMonthFromNextSub = parseInt(parts[0].trim().split('/')[0], 10);
            const subDate = parseInt(parts[0].trim().split('/')[1], 10);

            if (subMonthFromNextSub === curMonth && !isNaN(subDate)) {
                const subPv = parseFloat(parts[1]) || 0; // Extract PV value
                // const subPvString = parts[1].trim(); // Extract PV value as string
                // const subPv = parseFloat(subPvString.replace(/[^\d.-]/g, '')) || 0; // Parse numeric PV value
                const personalVolume = parseFloat(item.PersonalVolume) || 0;
                return subPv + personalVolume;
            }
        }
    }

    return 0;
};
const calculatePointsFromSubscription = (data, month) => {
    let pointsFromSubscription = 0;

    data.forEach((item) => {
        const customerType = item.CustomerType;
        const plexusPoints = parseFloat(item.PlexusPointsInOrganization) || 0;
        const level = parseInt(item.Level, 10) || 0;
        const PersonalVolume = parseInt(item.PersonalVolume, 10) || 0;

        const PVAfterSub = calculatePVAfterSub(item, month);
        const above100PV = calculateAbove100PV(level);
        const PV50_99 = calculate50_99PV(level);
        const PV25_49 = calculate25_49PV(level);


        const ptsFrom100Subs = (PVAfterSub > 99.99 && plexusPoints === 0) ? above100PV : 0;
        const ptsFrom50_99Subs = (PVAfterSub > 49.999 && PVAfterSub < 100 && plexusPoints === 0) ? PV50_99 : 0;
        const ptsFrom25_49Subs = (customerType === 'VIP Customer' && PVAfterSub > 24.99 && PVAfterSub < 50 && plexusPoints === 0) ? PV25_49 : 0;
        const extraPoints50_99IncreasingTo100Pv = (PersonalVolume > 49 && PersonalVolume < 100 && PVAfterSub > 99.999) ? (above100PV - PV50_99) : 0;
        const extraPoints25_49IncreasingTo50_99Pv = (PersonalVolume > 24 && PersonalVolume < 50 && PVAfterSub > 49.999 && PVAfterSub < 100) ? (PV50_99 - PV25_49) : 0;
        const extraPoints25_49IncreasingTo100PV = (PersonalVolume > 24 && PersonalVolume < 50 && PVAfterSub > 100) ? (above100PV - PV25_49) : 0;

        pointsFromSubscription += (ptsFrom100Subs + ptsFrom50_99Subs + ptsFrom25_49Subs + extraPoints50_99IncreasingTo100Pv + extraPoints25_49IncreasingTo50_99Pv + extraPoints25_49IncreasingTo100PV);
    });

    return pointsFromSubscription;
};

// Define functions to calculate PV thresholds
const calculateAbove100PV = (level) => {
    if (level === 1) return 6;
    if (level === 2) return 5;
    if (level === 3) return 5;
    if (level === 4) return 4;
    if (level === 5) return 3;
    if (level === 6) return 2;
    if (level === 7) return 1;
    return 0;
};

const calculate50_99PV = (level) => {
    if (level === 0) return 0;
    if (level === 1) return 4;
    if (level < 5) return 2;
    if (level < 8) return 1;
    return 0;
};

const calculate25_49PV = (level) => {
    if (level === 0) return 0;
    if (level === 1) return 2;
    if (level < 7) return 1;
    return 0;
};

// End Points from subscription........................................



//PointsGainedLastMonthWithoutSubs start
const calculatePointsGainedLastMonthWithoutSubs = (data) => {
    let pointsGained = 0;

    data.forEach((item) => {
        const plexusPoints = parseFloat(item.PlexusPointsInOrganization) || 0;
        const nextAutoOrder = item.NextAutoOrder;

        if (nextAutoOrder === undefined || nextAutoOrder === null || nextAutoOrder === "") {
            pointsGained += plexusPoints;
        }
    });

    return pointsGained;
};

//PointsGainedLastMonthWithoutSubs end





// TopRecruiters Start



//it is only for "/"
// const calculateTopRecruiters = (data, month) => {
//     const curMonth = Number(month);
//     const currentYear = new Date().getFullYear();

//     // Filter data based on CreatedDate matching the provided month and current year
//     const filteredData = data.filter((row) => {
//         const createdDate = row['CreatedDate'];
//         if (!createdDate) {
//             return false;
//         }

//         // Modify the regular expression to match dates with "/" and variable day length
//         const dateComponents = createdDate.match(/(\d+)\/(\d+)\/(\d+)/);
//         if (!dateComponents) {
//             return false; // Invalid date format
//         }

//         const [, month, day, year] = dateComponents;
//         return parseInt(month) === curMonth && parseInt(year) === currentYear;
//     });

//     // Count the occurrences of each SponsorName
//     const sponsorCounts = new Map();

//     filteredData.forEach((row) => {
//         const level = parseInt(row['Level']);
//         const sponsorLevel = level - 1;
//         if (sponsorLevel >= 1 && sponsorLevel <= 7) {
//             const sponsorName = `${row.SponsorFirstName} ${row.SponsorLastName}`;
//             sponsorCounts.set(sponsorName, (sponsorCounts.get(sponsorName) || 0) + 1);
//         }
//     });

//     // Convert the sponsorCounts map into an array of objects
//     const topNewVip = Array.from(sponsorCounts, ([SponsorName, TopNewVip]) => ({ SponsorName, TopNewVip }));

//     // Sort the topNewVip array in descending order based on TopNewVip
//     topNewVip.sort((a, b) => b.TopNewVip - a.TopNewVip);

//     return topNewVip;
// };

const calculateTopRecruiters = (data, month) => {
    const curMonth = Number(month);
    const currentYear = new Date().getFullYear();

    // Filter data based on CreatedDate matching the provided month and current year
    const filteredData = data.filter((row) => {
        const createdDate = row['CreatedDate'];
        if (!createdDate) {
            return false;
        }

        let dateComponents;
        // Check for the date format using a regular expression
        if (createdDate.includes('/')) {
            dateComponents = createdDate.match(/(\d+)\/(\d+)\/(\d+)/);
        } else if (createdDate.includes('-')) {
            dateComponents = createdDate.match(/(\d+)-(\d+)-(\d+)/);
        }

        if (!dateComponents) {
            return false; // Invalid date format
        }

        let day, month, year;
        // Check if the format is MM/DD/YYYY (with /) or DD-MM-YYYY (with -) and parse accordingly
        if (createdDate.includes('/')) {
            [, month = '', day = '', year = ''] = dateComponents;
        } else {
            [, day = '', month = '', year = ''] = dateComponents;
        }

        return parseInt(month) === curMonth && parseInt(year) === currentYear;
    });

    // Count the occurrences of each SponsorName
    const sponsorCounts = new Map();

    filteredData.forEach((row) => {
        const level = parseInt(row['Level']);
        const sponsorLevel = level - 1;
        if (sponsorLevel >= 1 && sponsorLevel <= 7) {
            const sponsorName = `${row.SponsorFirstName} ${row.SponsorLastName}`;
            sponsorCounts.set(sponsorName, (sponsorCounts.get(sponsorName) || 0) + 1);
        }
    });

    // Convert the sponsorCounts map into an array of objects
    const topNewVip = Array.from(sponsorCounts, ([SponsorName, TopNewVip]) => ({ SponsorName, TopNewVip }));

    // Sort the topNewVip array in descending order based on TopNewVip
    topNewVip.sort((a, b) => b.TopNewVip - a.TopNewVip);

    return topNewVip;
};





// TopRecruiters end

// TopLeadersWithNewAmbassadors Start

//it is for only "/"


// const calculateTopLeadersWithNewAmbassadors = (data, month) => {
//     const curMonth = Number(month);
//     const currentYear = new Date().getFullYear();

//     // Filter data based on JoinDate matching the current month and year
//     const filteredData = data.filter((row) => {
//         const joinDate = row['JoinDate'];
//         const customerType = row['CustomerType'];

//         if (!joinDate || customerType !== 'Brand Ambassador') {
//             return false;
//         }

//         // Modify the regular expression to match dates with "/" and variable day length
//         const dateComponents = joinDate.match(/(\d+)\/(\d+)\/(\d+)/);
//         if (!dateComponents) {
//             return false; // Invalid date format
//         }

//         const [, month, day, year] = dateComponents;
//         return parseInt(month) === curMonth && parseInt(year) === currentYear;
//     });

//     const newBrandAmbassadors = filteredData.length;
//     const newBrandAmbassadorReport = filteredData;

//     const sponsorCounts = new Map();

//     filteredData.forEach((row) => {
//         const level = parseInt(row['Level']);
//         const sponsorLevel = level - 1;
//         if (sponsorLevel >= 1 && sponsorLevel <= 7) {
//             const sponsorName = `${row.SponsorFirstName} ${row.SponsorLastName}`;
//             sponsorCounts.set(sponsorName, (sponsorCounts.get(sponsorName) || 0) + 1);
//         }
//     });

//     const topNewAmbassadors = Array.from(sponsorCounts, ([SponsorName, newAmbassadors]) => ({ SponsorName, newAmbassadors }));

//     topNewAmbassadors.sort((a, b) => b.newAmbassadors - a.newAmbassadors);

//     return { topNewAmbassadors, newBrandAmbassadors, newBrandAmbassadorReport };
// };

const calculateTopLeadersWithNewAmbassadors = (data, month) => {
    const curMonth = Number(month);
    const currentYear = new Date().getFullYear();

    // Filter data based on JoinDate matching the current month and year
    const filteredData = data.filter((row) => {
        const joinDate = row['JoinDate'];
        const customerType = row['CustomerType'];

        if (!joinDate || customerType !== 'Brand Ambassador') {
            return false;
        }

        let dateComponents;
        // Check for the date format using a regular expression
        if (joinDate.includes('/')) {
            dateComponents = joinDate.match(/(\d+)\/(\d+)\/(\d+)/);
        } else if (joinDate.includes('-')) {
            dateComponents = joinDate.match(/(\d+)-(\d+)-(\d+)/);
        }

        if (!dateComponents) {
            return false; // Invalid date format
        }

        let day, month, year;
        // Check if the format is MM/DD/YYYY (with /) or DD-MM-YYYY (with -) and parse accordingly
        if (joinDate.includes('/')) {
            [, month = '', day = '', year = ''] = dateComponents;
        } else {
            [, day = '', month = '', year = ''] = dateComponents;
        }

        return parseInt(month) === curMonth && parseInt(year) === currentYear;
    });

    const newBrandAmbassadors = filteredData.length;
    const newBrandAmbassadorReport = filteredData;

    const sponsorCounts = new Map();

    filteredData.forEach((row) => {
        const level = parseInt(row['Level']);
        const sponsorLevel = level - 1;
        if (sponsorLevel >= 1 && sponsorLevel <= 7) {
            const sponsorName = `${row.SponsorFirstName} ${row.SponsorLastName}`;
            sponsorCounts.set(sponsorName, (sponsorCounts.get(sponsorName) || 0) + 1);
        }
    });

    const topNewAmbassadors = Array.from(sponsorCounts, ([SponsorName, newAmbassadors]) => ({ SponsorName, newAmbassadors }));

    topNewAmbassadors.sort((a, b) => b.newAmbassadors - a.newAmbassadors);

    return { topNewAmbassadors, newBrandAmbassadors, newBrandAmbassadorReport };
};




// TopLeadersWithNewAmbassadors end






const calculateCurrentPointsData = (data) => {
    // Filter the data to include only rows where PV is a valid number and not 0
    return data.filter((row) => parseInt(row.PlexusPointsInOrganization, 10) !== 0 && !isNaN(parseInt(row.PlexusPointsInOrganization, 10)));
};

// const filterDataForLvl1 = (data) => {
//     // Filter the data to include only rows with Level > 1, CustomerType as "VIP Customer",
//     // and JoinDate in the current month and year

//     const currentDate = new Date();
//     const targetMonth = currentDate.getMonth() + 1; // Get the current month (1 to 12)
//     const targetYear = currentDate.getFullYear(); // Get the current year

//     return data.filter((row) => {
//         if (row.CreatedDate) {
//             // Check if the CreatedDate property exists in the row
//             const [day, month, year] = row.CreatedDate.split(/[-/]/); // Split the date using either hyphen or slash

//             const createdMonth = parseInt(month, 10); // Parse the month as an integer
//             const createdYear = parseInt(year, 10);

//             return (
//                 parseInt(row.Level, 10) === 1 &&
//                 row.CustomerType === 'VIP Customer' &&
//                 createdMonth === targetMonth &&
//                 createdYear === targetYear
//             );
//         }
//         return false; // Skip rows without a valid CreatedDate
//     });
// };

const filterDataForLvl1 = (data) => {
    // Filter the data to include only rows with Level > 1, CustomerType as "VIP Customer",
    // and JoinDate in the current month and year

    const currentDate = new Date();
    const targetMonth = currentDate.getMonth() + 1; // Get the current month (1 to 12)
    const targetYear = currentDate.getFullYear(); // Get the current year

    return data.filter((row) => {
        if (row.CreatedDate) {
            // Check if the CreatedDate property exists in the row
            let dateComponents;
            // Check for the date format using a regular expression
            if (row.CreatedDate.includes('/')) {
                dateComponents = row.CreatedDate.match(/(\d+)\/(\d+)\/(\d+)/);
            } else if (row.CreatedDate.includes('-')) {
                dateComponents = row.CreatedDate.match(/(\d+)-(\d+)-(\d+)/);
            }

            if (dateComponents) {
                let month = '', day = '', year = '';
                // Check if the format is MM/DD/YYYY (with /) or DD-MM-YYYY (with -) and parse accordingly
                if (row.CreatedDate.includes('/')) {
                    [, month, day, year] = dateComponents;
                } else {
                    [, day, month, year] = dateComponents;
                }

                const createdMonth = parseInt(month, 10); // Parse the month as an integer
                const createdYear = parseInt(year, 10);

                return (
                    parseInt(row.Level, 10) === 1 &&
                    row.CustomerType === 'VIP Customer' &&
                    createdMonth === targetMonth &&
                    createdYear === targetYear
                );
            }
        }
        return false; // Skip rows without a valid CreatedDate
    });
};




// const filterDataForLvl2 = (data) => {
//     // Filter the data to include only rows with Level > 1, CustomerType as "VIP Customer",
//     // and JoinDate in the current month and year

//     const currentDate = new Date();
//     const targetMonth = currentDate.getMonth() + 1; // Get the current month (1 to 12)
//     const targetYear = currentDate.getFullYear(); // Get the current year

//     return data.filter((row) => {
//         if (row.CreatedDate) {
//             // Check if the CreatedDate property exists in the row
//             const [day, month, year] = row.CreatedDate.split(/[-/]/); // Split the date using either hyphen or slash

//             const createdMonth = parseInt(month, 10); // Parse the month as an integer
//             const createdYear = parseInt(year, 10);

//             return (
//                 parseInt(row.Level, 10) > 1 &&
//                 row.CustomerType === 'VIP Customer' &&
//                 createdMonth === targetMonth &&
//                 createdYear === targetYear
//             );
//         }
//         return false; // Skip rows without a valid CreatedDate
//     });
// };

const filterDataForLvl2 = (data) => {
    // Filter the data to include only rows with Level > 1, CustomerType as "VIP Customer",
    // and JoinDate in the current month and year

    const currentDate = new Date();
    const targetMonth = currentDate.getMonth() + 1; // Get the current month (1 to 12)
    const targetYear = currentDate.getFullYear(); // Get the current year

    return data.filter((row) => {
        if (row.CreatedDate) {
            // Check if the CreatedDate property exists in the row
            let dateComponents;
            // Check for the date format using a regular expression
            if (row.CreatedDate.includes('/')) {
                dateComponents = row.CreatedDate.match(/(\d+)\/(\d+)\/(\d+)/);
            } else if (row.CreatedDate.includes('-')) {
                dateComponents = row.CreatedDate.match(/(\d+)-(\d+)-(\d+)/);
            }

            if (dateComponents) {
                let month = '', day = '', year = '';
                // Check if the format is MM/DD/YYYY (with /) or DD-MM-YYYY (with -) and parse accordingly
                if (row.CreatedDate.includes('/')) {
                    [, month = '', day = '', year = ''] = dateComponents;
                } else {
                    [, day = '', month = '', year = ''] = dateComponents;
                }

                const createdMonth = parseInt(month, 10); // Parse the month as an integer
                const createdYear = parseInt(year, 10);

                return (
                    parseInt(row.Level, 10) > 1 &&
                    row.CustomerType === 'VIP Customer' &&
                    createdMonth === targetMonth &&
                    createdYear === targetYear
                );
            }
        }
        return false; // Skip rows without a valid CreatedDate
    });
};



const totalPv = (data) => {
    let total = 0;

    data.forEach((row) => {
        if (row.PersonalVolume) {
            total += parseFloat(row.PersonalVolume);
        }
    });

    return total;
};





export const importPointsAndRankupReport = catchAsyncError(async (req, res, next) => {
    const month = req.body.selectedMonth


    if (!req.files || !req.files.file) {
        return next(new ErrorHandler("Please upload a file.", 400));
    }

    const file = req.files.file;

    if (!file.mimetype.startsWith("text/csv")) {
        return next(new ErrorHandler("Please upload a CSV file.", 400));
    }

    try {

        const userId = req.user.id;
        const s3Key = `uploads/${userId}/PointsAndRankup/PointsAndRankup${month}Report.csv`;

        try {
            const deleteCommand = new DeleteObjectCommand({
                Bucket: "theanalyticaladvantage",
                Key: s3Key,
            });
            await s3.send(deleteCommand);

            const uploadCommand = new PutObjectCommand({
                Bucket: "theanalyticaladvantage",
                Key: s3Key,
                Body: Buffer.from(file.data)
            });
            await s3.send(uploadCommand);
        } catch (uploadError) {
            console.error("Error while uploading file:", uploadError);
            return next(new ErrorHandler("Error uploading file to S3.", 500));
        }

        // Generate a presigned URL for fetching the uploaded CSV file from S3
        const presignedUrl = await getSignedUrl(s3, new GetObjectCommand({
            Bucket: "theanalyticaladvantage",
            Key: s3Key,
        }));

        // Fetch the CSV data from the S3 object using the presigned URL
        const response = await fetch(presignedUrl);
        const csvData = await response.text();

        await PointsAndRankup.deleteMany({ monthNo: month, userId: userId });
        Papa.parse(csvData, {
            complete: async (results) => {
                const data = results.data;



                
                
                //here you can change orders by filtereddata or Pv
                
                // const filteredData = await filterData(data, month);
                // const monthlyOrdersRows = filteredData.length

                
                const filteredData = totalOrders(data)
                const monthlyOrdersRows = totalOrders.length

                const filterdDataForCc = filterDataForCcReport(data, month);

                const dataForLegs = calculateLevel1Legs(data, month);

                //end 

                // Create a new array with unique LegNames and the sum of PlexusPointsInOrganization for each common LegName
                const legNamesArray = Array.from(dataForLegs.reduce((acc, item) => {
                    const { LegName, PlexusPointsInOrganization } = item;
                    acc.set(LegName, (acc.get(LegName) || 0) + PlexusPointsInOrganization);
                    return acc;
                }, new Map()), ([LegName, PlexusPointsInOrganization]) => ({ LegName, PlexusPointsInOrganization }));


                // Create a new array with the top 5 rows that have the maximum PlexusPointsInOrganization
                const top8Rows = legNamesArray
                    .sort((a, b) => b.PlexusPointsInOrganization - a.PlexusPointsInOrganization)
                    .slice(0, 8);


                const { totalProceedThisMonth, subsDeclineThisMonth, subsDeclineLastMonth } = calculateCreditCardDeclineRate(data, month);

                const topRecruiters = calculateTopRecruiters(data, month)

                const { topNewAmbassadors, newBrandAmbassadors, newBrandAmbassadorReport } = calculateTopLeadersWithNewAmbassadors(data, month)
                // //for Forcasting Estimate
                const { fullyCompressedPts, pointsGainedThisMonthWithoutSubscription, newVipsTotal, pointsFromNewVips, ptsWorthForRetention, recordedThisMonthForRetention } = await calculateFullyCompressedPoints(data, month)
                console.log(ptsWorthForRetention)
                const totalPlexusPoints = await sumOfTotalPlexusPoints(data, month)


                const totalPointsFromSubscription = await calculatePointsFromSubscription(data, month);

                const calculatedCurrentPointsData = await calculateCurrentPointsData(data);
                const totalCurrentPoints = calculatedCurrentPointsData.reduce((acc, row) => acc + parseInt(row.PlexusPointsInOrganization, 10), 0);

                const filteredDataForLvl1 = await filterDataForLvl1(data);
                const level1VipsCount = filteredDataForLvl1.length;
                const filteredDataForLvl2 = await filterDataForLvl2(data);
                const level2PlusVipsCount = filteredDataForLvl2.length;

                const totalPersonalVolume = totalPv(data)

                const { lastMonthVipsTotal, lastMonthPointsFromNewVips, orderedLastMonthForRetention } = await lastMonthVips(data);


                console.log(filteredDataForLvl1)


                const pointGainLastMonthWithoutSubs = calculatePointsGainedLastMonthWithoutSubs(data, month);

                try {
                    const ordersMonthlyReport = filteredData.map((row) => ({
                        CustomerID: row.CustomerID,
                        FirstName: row.FirstName,
                        LastName: row.LastName,
                        Phone: row.Phone,
                        Email: row.Email,
                        SponsorID: row.SponsorID,
                        SponsorFirstName: row.SponsorFirstName,
                        SponsorLastName: row.SponsorLastName,
                        Level: row.Level,
                        PersonalVolume: row.PersonalVolume,
                        NextAutoOrder: row.NextAutoOrder,
                        OrderIDList: row.OrderIDList,
                    }));
                    const filterdDataForCreditCardReport = filterdDataForCc.map((row) => ({
                        CustomerID: row.CustomerID,
                        FirstName: row.FirstName,
                        LastName: row.LastName,
                        Phone: row.Phone,
                        Email: row.Email,
                        SponsorID: row.SponsorID,
                        SponsorFirstName: row.SponsorFirstName,
                        SponsorLastName: row.SponsorLastName,
                        Level: row.Level,
                        PersonalVolume: row.PersonalVolume,
                        NextAutoOrder: row.NextAutoOrder,
                        OrderIDList: row.OrderIDList,
                        CustomerType: row.CustomerType,
                    }));
                    const newBrandAmbassadorsReport = newBrandAmbassadorReport.map((row) => ({
                        CustomerID: row.CustomerID,
                        FirstName: row.FirstName,
                        LastName: row.LastName,
                        Phone: row.Phone,
                        Email: row.Email,
                        SponsorID: row.SponsorID,
                        SponsorFirstName: row.SponsorFirstName,
                        SponsorLastName: row.SponsorLastName,
                        CustomerType: row.CustomerType,
                        Level: row.Level,
                        PersonalVolume: row.PersonalVolume,
                        NextAutoOrder: row.NextAutoOrder,
                        OrderIDList: row.OrderIDList,
                    }));
                    const Lvl1VipsReport = filteredDataForLvl1.map((row) => ({
                        CustomerID: row.CustomerID,
                        FirstName: row.FirstName,
                        LastName: row.LastName,
                        Phone: row.Phone,
                        Email: row.Email,
                        SponsorID: row.SponsorID,
                        SponsorFirstName: row.SponsorFirstName,
                        SponsorLastName: row.SponsorLastName,
                        CustomerType: row.CustomerType,
                        Level: row.Level,
                        PersonalVolume: row.PersonalVolume,
                        NextAutoOrder: row.NextAutoOrder,
                        OrderIDList: row.OrderIDList,
                        CreatedDate: row.CreatedDate,
                        JoinDate: row.JoinDate,
                    }));
                    const Lvl2PlusVipsReport = filteredDataForLvl2.map((row) => ({
                        CustomerID: row.CustomerID,
                        FirstName: row.FirstName,
                        LastName: row.LastName,
                        Phone: row.Phone,
                        Email: row.Email,
                        SponsorID: row.SponsorID,
                        SponsorFirstName: row.SponsorFirstName,
                        SponsorLastName: row.SponsorLastName,
                        CustomerType: row.CustomerType,
                        Level: row.Level,
                        PersonalVolume: row.PersonalVolume,
                        NextAutoOrder: row.NextAutoOrder,
                        OrderIDList: row.OrderIDList,
                        CreatedDate: row.CreatedDate,
                        JoinDate: row.JoinDate,
                    }));
                    const currentPointsReport = calculatedCurrentPointsData.map((row) => ({
                        CustomerID: row.CustomerID,
                        FirstName: row.FirstName,
                        LastName: row.LastName,
                        Phone: row.Phone,
                        Email: row.Email,
                        SponsorID: row.SponsorID,
                        SponsorFirstName: row.SponsorFirstName,
                        SponsorLastName: row.SponsorLastName,
                        CustomerType: row.CustomerType,
                        Level: row.Level,
                        PersonalVolume: row.PersonalVolume,
                        NextAutoOrder: row.NextAutoOrder,
                        OrderIDList: row.OrderIDList,
                        PlexusPointsInOrganization: row.PlexusPointsInOrganization,
                    }));
                    const legNamesArrayReport = legNamesArray.map((row) => ({
                        LegName: row.LegName,
                        PlexusPointsInOrganization: row.PlexusPointsInOrganization,
                    }));
                    const top8RowsLegsReport = top8Rows.map((row) => ({
                        LegName: row.LegName,
                        PlexusPointsInOrganization: row.PlexusPointsInOrganization,
                    }));
                    const topRecruitersReport = topRecruiters.map((row) => ({
                        SponsorName: row.SponsorName,
                        TopNewVip: row.TopNewVip,
                    }));
                    const topLeadersWithNewAmbassadorsReport = topNewAmbassadors.map((row) => ({
                        SponsorName: row.SponsorName,
                        newAmbassadors: row.newAmbassadors,
                    }));


                    const pointsAndRankupReport = new PointsAndRankup({
                        monthNo: month,
                        ordersMonthlyReport,
                        filterdDataForCreditCardReport,
                        legNamesArrayReport,
                        currentPointsReport,
                        top8RowsLegsReport,
                        topRecruitersReport,
                        topLeadersWithNewAmbassadorsReport,
                        monthlyOrders: monthlyOrdersRows,
                        totalOrderProceedThisMonth: totalProceedThisMonth,
                        suspectedSubsDeclinedThisMonth: subsDeclineThisMonth,
                        suspectedSubsDeclinedLastMonth: subsDeclineLastMonth,
                        fullyCompressedPointsValue: fullyCompressedPts,
                        totalPlexusPoints: totalPlexusPoints,
                        totalPointsFromSubscription,
                        pointsGainedLastMonthWithoutSubs: pointGainLastMonthWithoutSubs,
                        pointsGainedThisMonthWithoutSubs: pointsGainedThisMonthWithoutSubscription,
                        newVipsTotal,
                        pointsFromNewVips,
                        lastMonthVipsTotal,
                        lastMonthPointsFromNewVips,


                        ptsWorthForRetention,
                        orderedLastMonthForRetention,
                        recordedThisMonthForRetention,

                        newBrandAmbassadorsCount: newBrandAmbassadors,
                        userId: req.user.id,
                        newBrandAmbassadorReport: newBrandAmbassadorsReport,
                        totalCurrentPoints,
                        Lvl1VipsReport,
                        Lvl2PlusVipsReport,
                        level1VipsCount,
                        level2PlusVipsCount,
                        totalPersonalVolume



                    });

                    await pointsAndRankupReport.save();

                    res.status(200).json({
                        success: true,

                    });
                } catch (error) {
                    console.error("Error while saving processed data:", error);
                    return next(new ErrorHandler("Error saving processed data to the database.", 500));
                }
            },
            header: true,
        });
    } catch (error) {
        console.error("Error while processing data:", error);
        return next(new ErrorHandler("Error processing data.", 500));
    }
});

export const getForcastingEstimate = catchAsyncError(async (req, res, next) => {

    const currentDate = new Date();
    const monthNo = currentDate.getMonth() + 1;
    const previousMonth = monthNo === 1 ? 12 : monthNo - 1;
    const previousMonthKey = previousMonth.toString();
    // const monthNo = 8
    try {
        const userId = req.user.id;
        // Find the PointsAndRankup document for the specified month
        const report = await PointsAndRankup.findOne({ userId, monthNo });
        const previousMonthReport = await PointsAndRankup.findOne({userId, monthNo: monthNo - 1 });

        if (!report) {
            return next(new ErrorHandler(`No data found for this month ${monthNo}.`, 404));
        }
        else if (!previousMonthReport) {
            return next(new ErrorHandler(`No data found for previous month ${monthNo}.`, 404));
        }
        const ordersMonthlyReport = report.ordersMonthlyReport
        const ordersPreviousMonthsCount = previousMonthReport.ordersMonthlyReport.length
        const filterdDataForCreditCardReport = report.filterdDataForCreditCardReport
        const legNamesArrayReport = report.legNamesArrayReport
        const top8RowsLegsReport = report.top8RowsLegsReport
        const topRecruitersReport = report.topRecruitersReport
        const topLeadersWithNewAmbassadorsReport = report.topLeadersWithNewAmbassadorsReport
        const monthlyOrders = report.monthlyOrders
        const previousMonthOrders = previousMonthReport.monthlyOrders
        const newBrandAmbassadors = report.newBrandAmbassadorsCount
        const currentPointsReport = report.currentPointsReport
        const totalCurrentPoints = report.totalCurrentPoints

        const Lvl1VipsReport = report.Lvl1VipsReport
        const Lvl2PlusVipsReport = report.Lvl2PlusVipsReport
        const level1VipsCount = report.level1VipsCount
        const level2PlusVipsCount = report.level2PlusVipsCount
        
        const totalCurMonthPersonalVolume = report.totalPersonalVolume
        const totalPrevMonthPersonalVolume = previousMonthReport.totalPersonalVolume


        const totalOrderProceedThisMonth = report.totalOrderProceedThisMonth
        const suspectedSubsDeclinedThisMonth = report.suspectedSubsDeclinedThisMonth
        const totalOrderProceedLastMonth = previousMonthReport.totalOrderProceedThisMonth
        const suspectedSubsDeclinedLastMonth = previousMonthReport.suspectedSubsDeclinedLastMonth
        const ccDeclineRate = ((suspectedSubsDeclinedLastMonth + suspectedSubsDeclinedThisMonth) / (totalOrderProceedLastMonth + totalOrderProceedThisMonth + suspectedSubsDeclinedLastMonth + suspectedSubsDeclinedThisMonth)) * 100;


        const fullyCompressedPoints = report.fullyCompressedPointsValue
        const fullyCompressedPointsLastMonth = previousMonthReport.fullyCompressedPointsValue
        const totalPlexusPoints = previousMonthReport.totalPlexusPoints
        const averageCompressionBonus = totalPlexusPoints - fullyCompressedPointsLastMonth

        const totalPointsFromSubscription = report.totalPointsFromSubscription

        const forcastingDeclineRate = totalPointsFromSubscription * ccDeclineRate / 100
        const subscriptionOnlyEstimate = fullyCompressedPoints + totalPointsFromSubscription + averageCompressionBonus - (forcastingDeclineRate)

        const pointsGainedThisMonthWithoutSubs = report.pointsGainedThisMonthWithoutSubs
        const pointsGainedLastMonthWithoutSubs = previousMonthReport.pointsGainedLastMonthWithoutSubs


        const newVipsTotal = report.newVipsTotal
        const pointsFromNewVips = report.pointsFromNewVips
        const lastMonthVipsTotal = previousMonthReport.lastMonthVipsTotal
        const lastMonthPointsFromNewVips = previousMonthReport.lastMonthPointsFromNewVips
        const newBrandAmbassadorReport = report.newBrandAmbassadorReport


        const percentOfPointsComingFromLastMonthDiscretionaryOrders = 50
        const percentOfPointsComingFromLastMonthNewVips = 80

        const differenceOfPointsGained = (pointsGainedLastMonthWithoutSubs * percentOfPointsComingFromLastMonthDiscretionaryOrders / 100) - pointsGainedThisMonthWithoutSubs

        let estimatedPointsComingFromDiscretionaryOrders;
        if (differenceOfPointsGained > 0) {
            estimatedPointsComingFromDiscretionaryOrders = differenceOfPointsGained

        } else {
            estimatedPointsComingFromDiscretionaryOrders = 0

        }

        const differenceEstimatedPointsComingFromDiscretionaryOrders = (lastMonthPointsFromNewVips * percentOfPointsComingFromLastMonthNewVips / 100) - pointsFromNewVips

        let estimatedPointsComingFromNewVips;
        if (differenceEstimatedPointsComingFromDiscretionaryOrders > 0) {
            estimatedPointsComingFromNewVips = differenceEstimatedPointsComingFromDiscretionaryOrders

        } else {
            estimatedPointsComingFromNewVips = 0

        }


        // so finally what we get...... 
        const ForecastedLow = fullyCompressedPoints + totalPointsFromSubscription + (averageCompressionBonus * 0.75) + (-forcastingDeclineRate * 1.2) + (estimatedPointsComingFromDiscretionaryOrders * 0.5) + (estimatedPointsComingFromNewVips * 0.5)
        const ForecastedHigh = fullyCompressedPoints + totalPointsFromSubscription + averageCompressionBonus - forcastingDeclineRate + (estimatedPointsComingFromDiscretionaryOrders * 1.25) + (estimatedPointsComingFromNewVips * 1.25)
        const ForecastedEstimate = fullyCompressedPoints + totalPointsFromSubscription + averageCompressionBonus - forcastingDeclineRate + estimatedPointsComingFromDiscretionaryOrders + estimatedPointsComingFromNewVips


        //retention report 

        const ptsWorthForRetention = report.ptsWorthForRetention
        const recordedThisMonthForRetention = report.recordedThisMonthForRetention
        const orderedLastMonthForRetention = previousMonthReport.orderedLastMonthForRetention


        // Calculate lastMonthRetention
        const lastMonthRetention = {};
        orderedLastMonthForRetention.forEach((value, key) => {
            if (ptsWorthForRetention.has(key)) {
                lastMonthRetention[key] = (value / ptsWorthForRetention.get(key)) * 100;
            }
        });

        // Calculate currentMonthRetention

        const currentMonthRetention = {};
        recordedThisMonthForRetention.forEach((value, key) => {
            if (ptsWorthForRetention.has(key)) {
                if (key === previousMonthKey) {
                    currentMonthRetention[key] = (value / lastMonthPointsFromNewVips) * 100;
                } else {
                    currentMonthRetention[key] = (value / ptsWorthForRetention.get(key)) * 100;
                }
            }
        });

        res.status(200).json({
            success: true,
            totalCurMonthPersonalVolume,
            totalPrevMonthPersonalVolume,
            totalOrderProceedThisMonth,
            totalOrderProceedLastMonth,
            suspectedSubsDeclinedThisMonth,
            suspectedSubsDeclinedLastMonth,
            ccDeclineRate,
            fullyCompressedPoints,
            totalPlexusPoints,
            averageCompressionBonus,
            totalPointsFromSubscription,
            forcastingDeclineRate,
            subscriptionOnlyEstimate,
            pointsGainedThisMonthWithoutSubs,
            pointsGainedLastMonthWithoutSubs,
            differenceOfPointsGained,
            estimatedPointsComingFromDiscretionaryOrders,
            newVipsTotal,
            pointsFromNewVips,
            lastMonthPointsFromNewVips,
            lastMonthVipsTotal,
            differenceEstimatedPointsComingFromDiscretionaryOrders,
            estimatedPointsComingFromNewVips,

            ForecastedLow,
            ForecastedHigh,
            ForecastedEstimate,

            ptsWorthForRetention,
            recordedThisMonthForRetention,
            orderedLastMonthForRetention,
            lastMonthRetention,
            currentMonthRetention,
            ordersMonthlyReport,
            filterdDataForCreditCardReport,
            legNamesArrayReport,
            top8RowsLegsReport,
            topRecruitersReport,
            topLeadersWithNewAmbassadorsReport,
            monthlyOrders,
            newBrandAmbassadors,
            newBrandAmbassadorReport,
            currentPointsReport,
            totalCurrentPoints,
            level2PlusVipsCount,
            level1VipsCount,
            Lvl2PlusVipsReport,
            Lvl1VipsReport,
            previousMonthOrders,
            ordersPreviousMonthsCount

        });
    } catch (error) {
        console.error("Error while retrieving forecasting estimates:", error);
        return next(new ErrorHandler("Error retrieving forecasting estimates.", 500));
    }
});


export const orderReportFullYear = catchAsyncError(async (req, res, next) => {
    try {
        const allMonths = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];
        const userId = req.user.id;
        // Find the PointsAndRankup documents for all months
        const reports = await PointsAndRankup.find({ userId });

        const data = allMonths.map((monthName, index) => {
            const report = reports.find(report => report.monthNo === index + 1);
            const monthlyOrders = report ? report.monthlyOrders : 0;
            return { monthName, monthlyOrders };
        });

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("Error while retrieving forecasting estimates:", error);
        return next(new ErrorHandler("Error retrieving forecasting estimates.", 500));
    }
});
