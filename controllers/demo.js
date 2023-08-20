import fs from "fs";
import path from "path";
import Papa from "papaparse";
import url from "url";
import { ErrorHandler } from "../utils/errorHandler.js";
import { catchAsyncError } from "../middleware/catchAsyncError.js";
import PointsAndRankup from "../models/pointsAndRankupReport-model.js";

const filterData = (data) => {
    const currentMonth = new Date().getMonth() + 1; // Get the current month (1 to 12)
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

const filterDataForLastMonth = (data) => {
    const currentMonth = new Date().getMonth() + 1;
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    // Filter the data to include only rows where OrderIDList column doesn't contain "Declined" or "Cancelled",
    // is not blank, and has the current month
    return data.filter((row) => {
        const orderIdList = row['OrderIDList'] ?? ''; // Set orderIdList to an empty string if it's undefined
        const hasDeclinedOrCancelled = orderIdList.includes('Declined') || orderIdList.includes('Cancelled');
        const isBlank = orderIdList.trim() === ''; // Check if the OrderIDList column is blank
        const monthMatch = orderIdList.includes(`, ${previousMonth}/`); // Check if the orderIdList contains the current month

        return !hasDeclinedOrCancelled && !isBlank && monthMatch;
    });
};


const filterDataForCcReport = (data) => {
    const currentMonth = new Date().getMonth() + 1;
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

const calculateCreditCardDeclineRate = (data) => {
    const currentMonth = new Date().getMonth() + 1;
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;

    let totalProceedThisMonth = 0;
    let totalProceedLastMonth = 0;
    let subsDeclineThisMonth = 0;
    let subsDeclineLastMonth = 0;

    data.forEach((item) => {
        const orderIdList = item.OrderIDList || '';
        const nextAutoOrder = item.NextAutoOrder || '';
        const monthMatchThisMonth = orderIdList.includes(`, ${currentMonth}/`);
        const monthMatchLastMonth = orderIdList.includes(`, ${previousMonth}/`);
        const hasDeclinedOrCancelled = orderIdList.includes('Declined') || orderIdList.includes('Cancelled');

        if (monthMatchThisMonth && (orderIdList.includes('Shipped') || orderIdList.includes('Pending') || orderIdList.includes('Printed') || orderIdList.includes('Accepted'))) {
            totalProceedThisMonth++;
        }

        if (monthMatchLastMonth && (orderIdList.includes('Shipped') || orderIdList.includes('Pending') || orderIdList.includes('Printed') || orderIdList.includes('Accepted'))) {
            totalProceedLastMonth++;
        }

        if (nextAutoOrder !== '' && nextAutoOrder.includes(`${previousMonth}/`) && orderIdList.includes(`, ${previousMonth}/`) && hasDeclinedOrCancelled) {
            subsDeclineLastMonth++;
        }

        if (
            nextAutoOrder !== '' &&
            (nextAutoOrder.includes(`${currentMonth}/`) || nextAutoOrder.includes(`${currentMonth + 1}/`)) &&
            orderIdList.includes(`, ${currentMonth}/`) &&
            hasDeclinedOrCancelled
        ) {
            subsDeclineThisMonth++;
        }


    });

    return {
        totalProceedThisMonth,
        totalProceedLastMonth,
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
const calculateFullyCompressedPoints = (data) => {
    let fullyCompressedPts = 0;
    // console.log(data)
    data?.forEach((item) => {
        const plexusPoints = parseFloat(item.PlexusPointsInOrganization) || 0;
        const paidLevel = parseInt(item.PaidLevel, 10) || 0;
        const Level = parseInt(item.Level, 10) || 0;

        const PL100Above = calculatePL100Above(paidLevel);
        const PL50_99 = calculatePL50_99(paidLevel);
        const PL25_49 = calculatePL25_49(paidLevel);
        let compressedPts = 0;

        if (plexusPoints === 0) {
            compressedPts = 0;
        }
        else if (plexusPoints === PL100Above) {
            compressedPts = calculatePV100Above(Level);
        } else if (plexusPoints === PL50_99) {
            compressedPts = calculatePV50_99(Level);
        } else if (plexusPoints === PL25_49) {
            compressedPts = calculatePV25_49(Level);
        }
        fullyCompressedPts += compressedPts;
    });

    return fullyCompressedPts;
};

const sumOfTotalPlexusPoints = (data) => {
    let sumOfPlexusPoints = 0; // Initialize the sum to 0

    data.forEach((item) => {
        const plexusPoints = parseFloat(item.PlexusPointsInOrganization) || 0;
        sumOfPlexusPoints += plexusPoints; // Add current plexusPoints to the sum
    });

    return sumOfPlexusPoints; // Return the sum
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
const calculatePVAfterSub = (item) => {
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
const calculatePointsFromSubscription = (data) => {
    let pointsFromSubscription = 0;

    data.forEach((item) => {
        const customerType = item.CustomerType;
        const plexusPoints = parseFloat(item.PlexusPointsInOrganization) || 0;
        const level = parseInt(item.Level, 10) || 0;
        const PersonalVolume = parseInt(item.PersonalVolume, 10) || 0;

        const PVAfterSub = calculatePVAfterSub(item);
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
const calculateTopRecruiters = (data) => {
    const currentMonth = new Date().getMonth() + 1;

    // Filter data based on CreatedDate matching the current month and year
    // const filteredData = data.filter((row) => {
    //     const createdDate = row['CreatedDate'];
    //     if (!createdDate) {
    //         return false;
    //     }

    //     const [date, month, year] = createdDate.split('-');
    //     return parseInt(month) === currentMonth && parseInt(year) === new Date().getFullYear();
    // });

    const filteredData = data.filter((row) => {
        const createdDate = row['CreatedDate'];
        if (!createdDate) {
            return false;
        }

        const [date, month, year] = createdDate.split('-');
        const currentDate = new Date();
        const previousMonth = currentDate.getMonth(); // Get the previous month (0 to 11)
        const currentYear = currentDate.getFullYear();

        // Calculate the previous month and year
        const previousMonthYear = previousMonth === 0 ? currentYear - 1 : currentYear;
        const previousMonthNumber = previousMonth === 0 ? 12 : previousMonth;

        return parseInt(month) === previousMonthNumber && parseInt(year) === previousMonthYear;
    });

    // Count the occurrences of each SponsorName
    const sponsorCounts = new Map();

    filteredData.forEach((row) => {
        const level = parseInt(row['Level']);
        const sponsorLevel = level - 1
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
const calculateTopLeadersWithNewAmbassadors = (data) => {
    const currentMonth = new Date().getMonth() + 1;

    // Filter data based on JoinDate matching the current month and year
    // const filteredData = data.filter((row) => {
    //     const joinDate = row['JoinDate'];
    //     const customerType = row['CustomerType'];

    //     if (!joinDate || customerType !== 'Brand Ambassador') {
    //         return false;
    //     }


    //     const [date, month, year] = joinDate.split('-');
    //     return parseInt(month) === currentMonth && parseInt(year) === new Date().getFullYear();
    // });

    const filteredData = data.filter((row) => {
        const joinDate = row['JoinDate'];
        const customerType = row['CustomerType'];

        if (!joinDate || customerType !== 'Brand Ambassador') {
            return false;
        }


        const [date, month, year] = joinDate.split('-');
        const currentDate = new Date();
        const previousMonth = currentDate.getMonth(); // Get the previous month (0 to 11)
        const currentYear = currentDate.getFullYear();

        // Calculate the previous month and year
        const previousMonthYear = previousMonth === 0 ? currentYear - 1 : currentYear;
        const previousMonthNumber = previousMonth === 0 ? 12 : previousMonth;

        return parseInt(month) === previousMonthNumber && parseInt(year) === previousMonthYear;
    });

    // Count the occurrences of each SponsorName
    const sponsorCounts = new Map();

    filteredData.forEach((row) => {
        const level = parseInt(row['Level']);
        const sponsorLevel = level - 1
        if (sponsorLevel >= 1 && sponsorLevel <= 7) {
            const sponsorName = `${row.SponsorFirstName} ${row.SponsorLastName}`;
            sponsorCounts.set(sponsorName, (sponsorCounts.get(sponsorName) || 0) + 1);
        }
    });

    const topNewAmbassadors = Array.from(sponsorCounts, ([SponsorName, newAmbassadors]) => ({ SponsorName, newAmbassadors }));

    topNewAmbassadors.sort((a, b) => b.newAmbassadors - a.newAmbassadors);

    return topNewAmbassadors;
};
// TopLeadersWithNewAmbassadors end




export const importPointsAndRankupReport = catchAsyncError(async (req, res, next) => {
    const monthNo = req.body.month
    const currentMonth = new Date().getMonth()

    console.log(monthNo)


    if (!req.files || !req.files.file) {
        return next(new ErrorHandler("Please upload a file.", 400));
    }

    const file = req.files.file;

    if (!file.mimetype.startsWith("text/csv")) {
        return next(new ErrorHandler("Please upload a CSV file.", 400));
    }

    try {
        const filePath = path.join(url.fileURLToPath(import.meta.url), `../../uploads/PointsAndRankup${monthNo}Report.csv`);

        // Delete the old CSV file if it exists
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            // Ignore errors if the file does not exist
        }

        await file.mv(filePath);

        // Delete existing database entry for the specified month
        await PointsAndRankup.deleteMany({ monthNo: monthNo });

        const csvData = fs.readFileSync(filePath, "utf-8");

        Papa.parse(csvData, {
            complete: async (results) => {
                const data = results.data;


                // Clear existing data from the database
                await PointsAndRankup.deleteMany({});

                const filteredData = await filterData(data);
                const filteredDataForLastMonth = await filterDataForLastMonth(data);
                const monthlyOrdersRows = filteredData.length

                const filterdDataForCc = filterDataForCcReport(data);

                const dataForLegs = calculateLevel1Legs(data);

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

                console.log("a")

                const { totalProceedThisMonth, totalProceedLastMonth, subsDeclineThisMonth, subsDeclineLastMonth } = calculateCreditCardDeclineRate(data);
                const ccDeclineRate = ((subsDeclineLastMonth + subsDeclineThisMonth) / (totalProceedLastMonth + totalProceedThisMonth + subsDeclineLastMonth + subsDeclineThisMonth)) * 100;
                console.log("a")

                const topRecruiters = calculateTopRecruiters(data)
                console.log("a")
                const topLeadersWithNewAmbassadors = calculateTopLeadersWithNewAmbassadors(data)
                console.log("a")

                //for Forcasting Estimate
                const fullyCompressedPoints = await calculateFullyCompressedPoints(data)
                const totalPlexusPoints = await sumOfTotalPlexusPoints(data)
                const CompressionBonus = totalPlexusPoints - fullyCompressedPoints


                const totalPointsFromSubscription = await calculatePointsFromSubscription(data);




                const forcastingDeclineRate = totalPointsFromSubscription * ccDeclineRate / 100
                const subscriptionOnlyEstimate = fullyCompressedPoints + totalPointsFromSubscription + CompressionBonus - (totalPointsFromSubscription * ccDeclineRate / 100)

                const pointGainLastMonthWithoutSubs = calculatePointsGainedLastMonthWithoutSubs(filteredDataForLastMonth);

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
                    const topLeadersWithNewAmbassadorsReport = topLeadersWithNewAmbassadors.map((row) => ({
                        SponsorName: row.SponsorName,
                        newAmbassadors: row.newAmbassadors,
                    }));


                    const pointsAndRankupReport = new PointsAndRankup({
                        monthNo,
                        ordersMonthlyReport,
                        filterdDataForCreditCardReport,
                        legNamesArrayReport,
                        top8RowsLegsReport,
                        topRecruitersReport,
                        topLeadersWithNewAmbassadorsReport,
                        monthlyOrders: monthlyOrdersRows,
                        creditCardDeclineRate: ccDeclineRate,
                        fullyCompressedPointsValue: fullyCompressedPoints,
                        averageCompressionBonus: CompressionBonus,
                        totalPointsFromSub: totalPointsFromSubscription,
                        forcastingDeclineRate,
                        subscriptionOnlyEstimate,
                        pointsGainedLastMonthWithoutSubs: pointGainLastMonthWithoutSubs
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
