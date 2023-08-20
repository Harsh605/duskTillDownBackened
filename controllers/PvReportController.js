import Papa from "papaparse";
import { ErrorHandler } from "../utils/errorHandler.js";
import { catchAsyncError } from "../middleware/catchAsyncError.js";
import PvReport from "../models/pvReport-model.js";
import {S3Client,DeleteObjectCommand,PutObjectCommand,GetObjectCommand,} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../middleware/awsConfig.js"



const pvFilterData = (data) => {
    // Filter the data to include only rows where PV is a valid number and not 0
    return data.filter((row) => parseInt(row.PV, 10) !== 0 && !isNaN(parseInt(row.PV, 10)));
};

const retailsFilterData = (data) => {
    const currentMonth = new Date().getMonth() + 1; // Get the current month (1 to 12)
    const currentYear = new Date().getFullYear(); // Get the current year

    return data.filter((row) => {
        const accountCreatedDate = new Date(row['Account Created']);
        const accountCreatedMonth = accountCreatedDate.getMonth() + 1; // Get the month from "Account Created" (1 to 12)
        const accountCreatedYear = accountCreatedDate.getFullYear(); // Get the year from "Account Created"

        // Check if the "Account Created" month and year match the current month and year
        const isSameMonthAndYear = accountCreatedMonth === currentMonth && accountCreatedYear === currentYear;

        return isSameMonthAndYear;
    });
};
export const importPvReport = catchAsyncError(async (req, res, next) => {

    if (!req.files || !req.files.file) {
        return next(new ErrorHandler("Please upload a file.", 400));
    }

    const file = req.files.file;

    if (!file.mimetype.startsWith("text/csv")) {
        return next(new ErrorHandler("Please upload a CSV file.", 400));
    }

    try {
        const userId = req.user.id;
        const s3Key = `uploads/${userId}/PvReport.csv`;

        try {
            const deleteCommand = new DeleteObjectCommand({
                Bucket:  process.env.IMAGE_BUCKET,
                Key: s3Key,
            });
            await s3.send(deleteCommand);

            const uploadCommand = new PutObjectCommand({
                Bucket:  process.env.IMAGE_BUCKET,
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
            Bucket:  process.env.IMAGE_BUCKET,
            Key: s3Key,
        }));

        // Fetch the CSV data from the S3 object using the presigned URL
        const response = await fetch(presignedUrl);
        const csvData = await response.text();
    
            // Fetch the CSV data from the S3 object using the presigned URL
    

        Papa.parse(csvData, {
            complete: async (results) => {
                const data = results.data;

                // Clear existing data from the database
                await PvReport.deleteMany({userId});

                const pvFilteredData = await pvFilterData(data);
                const retailsFilteredData = await retailsFilterData(pvFilteredData);

                const totalPV = pvFilteredData.reduce((acc, row) => acc + parseInt(row.PV, 10), 0);
                const newRetails = retailsFilteredData.length;

                try {
                    const pvReportData = pvFilteredData.map((row) => ({
                        customerID: row['Customer ID'],
                        firstName: row['First Name'],
                        lastName: row['Last Name'],
                        PV: parseInt(row.PV, 10),
                        email: row.Email,
                        phone: row.Phone,
                        // ... add other properties as needed
                    }));

                    const retailReportData = retailsFilteredData.map((row) => ({
                        customerID: row['Customer ID'],
                        firstName: row['First Name'],
                        lastName: row['Last Name'],
                        PV: parseInt(row.PV, 10),
                        email: row.Email,
                        phone: row.Phone,
                        // ... add other properties as needed
                    }));

                    const pvReport = new PvReport({
                        userId: req.user.id,
                        pvReport: pvReportData,
                        retailReport: retailReportData,
                        currentPv: totalPV,
                        newRetails
                    });

                    await pvReport.save();

                    res.status(200).json({
                        success: true,
                        pvFilteredData,
                        retailsFilteredData,
                        newRetails,
                        totalPV,
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



export const getPvReportData = catchAsyncError(async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Find the PointsAndRankup document(s) - use findOne() if you expect a single document
        const report = await PvReport.findOne({ userId });
        if (!report || report.length === 0) {
            return next(new ErrorHandler("No data found.", 404));
        }

        // Assuming you have only one report for this example

        const currentPv = report.currentPv; // Access the currentPv property
        const newRetails = report.newRetails; // Access the newRetails property
        const pvReport = report.pvReport; // Access the newRetails property
        const retailsReport = report.retailReport; // Access the newRetails property

        res.status(200).json({
            success: true,
            currentPv,
            newRetails,
            pvReport,
            retailsReport
        });
    } catch (error) {
        console.error("Error while retrieving data:", error);
        return next(new ErrorHandler("Error retrieving data.", 500));
    }
});
