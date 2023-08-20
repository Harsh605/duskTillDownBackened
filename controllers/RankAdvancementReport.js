
import Papa from "papaparse";
import { ErrorHandler } from "../utils/errorHandler.js";
import { catchAsyncError } from "../middleware/catchAsyncError.js";
import RankAdvancement from "../models/rankAdvancementReport-model.js";

import { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand, } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../middleware/awsConfig.js"

const filterData = (data) => {
    const currentMonth = new Date().getMonth() + 1; // Get the current month (1 to 12)
    // Filter the data to include only rows where OrderIDList column doesn't contain "Declined" or "Cancelled",
    // is not blank, and has the current month
    return data.filter((row) => {
        const orderIdList = row['Projected Rank'] ?? ''; // Set ProjectedRank to an empty string if it's undefined
        const isBlank = orderIdList.trim() === ''; // Check if the ProjectedRank column is blank

        return !isBlank;
    });
};

export const importRankAdvancementReport = catchAsyncError(async (req, res, next) => {
    if (!req.files || !req.files.file) {
        return next(new ErrorHandler("Please upload a file.", 400));
    }

    const file = req.files.file;

    if (!file.mimetype.startsWith("text/csv")) {
        return next(new ErrorHandler("Please upload a CSV file.", 400));
    }

    try {
        const userId = req.user.id;
        const s3Key = `uploads/${userId}/RankAdvancementReport.csv`;

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

        Papa.parse(csvData, {
            complete: async (results) => {
                const data = results.data;


                // Clear existing data from the database
                await RankAdvancement.deleteMany({userId});

                const filteredData = filterData(data);
                const totalRanksRow = filteredData.length

                // console.log(filteredData)


                try {
                    const newRanksReportData = filteredData.map((row) => ({
                        CustomerID: row.CustomerID,
                        FirstName: row.FirstName,
                        LastName: row.LastName,
                        Phone: row.Phone,
                        Email: row.Email,
                        SponsorID: row.SponsorID,
                        SponsorFirstName: row.SponsorFirstName,
                        SponsorLastName: row.SponsorLastName,
                        Level: row.Level,
                        ProjectedRank: row['Projected Rank'],
                    }));

                    const RankAdvancementReport = new RankAdvancement({
                        newRanksReport: newRanksReportData,
                        newRanks: totalRanksRow,
                        userId: req.user.id

                    });

                    await RankAdvancementReport.save();

                    res.status(200).json({
                        success: true,
                        newRanks: totalRanksRow,
                        filteredData
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

export const getRankAdvancementReportData = catchAsyncError(async (req, res, next) => {
    try {
        const userId = req.user.id;
        // Find the PointsAndRankup document(s) - use findOne() if you expect a single document
        const report = await RankAdvancement.findOne({userId});
        if (!report || report.length === 0) {
            return next(new ErrorHandler("No data found.", 404));
        }

        // Assuming you have only one report for this example

        const newRanksReport = report.newRanksReport; // Access the currentPv property
        const newRanks = report.newRanks
            ; // Access the currentPv property


        res.status(200).json({
            success: true,
            newRanksReport,
            newRanks

        });
    } catch (error) {
        console.error("Error while retrieving data:", error);
        return next(new ErrorHandler("Error retrieving data.", 500));
    }
});