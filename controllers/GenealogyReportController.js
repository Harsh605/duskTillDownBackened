import fs from "fs";
import path from "path";
import Papa from "papaparse";
import url from "url";
import { ErrorHandler } from "../utils/errorHandler.js";
import { catchAsyncError } from "../middleware/catchAsyncError.js";
import GenealogyReport from "../models/genealogyReport-model.js";

import { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand, } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../middleware/awsConfig.js"

const filterData = (data) => {
  // Filter the data to include only rows where PV is a valid number and not 0
  return data.filter((row) => parseInt(row.Points, 10) !== 0 && !isNaN(parseInt(row.Points, 10)));
};

const filterDataForLvl1 = (data) => {
  // Filter the data to include only rows with Level > 1, CustomerType as "VIP Customer",
  // and JoinDate in the current month and year

  const currentDate = new Date();
  const targetMonth = currentDate.getMonth() + 1; // Get the current month (1 to 12)
  const targetYear = currentDate.getFullYear(); // Get the current year

  return data.filter((row) => {
    if (row.JoinDate) {
      // Check if the JoinDate property exists in the row
      const joinDate = new Date(row.JoinDate.replace('-', '/')); // Convert hyphens to slashes for consistency

      const joinMonth = joinDate.getMonth() + 1; // Months are 0-indexed, so add 1
      const joinYear = joinDate.getFullYear();

      return (
        parseInt(row.Level, 10) === 1 &&
        row.CustomerType === 'VIP Customer' &&
        joinMonth === targetMonth &&
        joinYear === targetYear
      );
    }
    return false; // Skip rows without a valid JoinDate
  });
};

const filterDataForLvl2 = (data) => {
  // Filter the data to include only rows with Level > 1, CustomerType as "VIP Customer",
  // and JoinDate in the current month and year

  const currentDate = new Date();
  const targetMonth = currentDate.getMonth() + 1; // Get the current month (1 to 12)
  const targetYear = currentDate.getFullYear(); // Get the current year

  return data.filter((row) => {
    if (row.JoinDate) {
      // Check if the JoinDate property exists in the row
      const joinDate = new Date(row.JoinDate.replace('-', '/')); // Convert hyphens to slashes for consistency

      const joinMonth = joinDate.getMonth() + 1; // Months are 0-indexed, so add 1
      const joinYear = joinDate.getFullYear();

      return (
        parseInt(row.Level, 10) > 1 &&
        row.CustomerType === 'VIP Customer' &&
        joinMonth === targetMonth &&
        joinYear === targetYear
      );
    }
    return false; // Skip rows without a valid JoinDate
  });
};

const filterDataForBrandAmbassadors = (data) => {
  // Filter the data to include only rows with CustomerType as "Brand Ambassador"
  // and UpgradeDate in the current month and year

  const currentDate = new Date();
  const targetMonth = currentDate.getMonth() + 1; // Get the current month (1 to 12)
  const targetYear = currentDate.getFullYear(); // Get the current year

  return data.filter((row) => {
    if (row.CustomerType === 'Brand Ambassador' && row.UpgradeDate) {
      // Check if the UpgradeDate property exists in the row
      const upgradeDate = new Date(row.UpgradeDate.replace('-', '/')); // Convert hyphens to slashes for consistency

      const upgradeMonth = upgradeDate.getMonth() + 1; // Months are 0-indexed, so add 1
      const upgradeYear = upgradeDate.getFullYear();

      return upgradeMonth === targetMonth && upgradeYear === targetYear;
    }
    return false; // Skip rows without a valid UpgradeDate or with CustomerType other than "Brand Ambassador"
  });
};

export const importGenealogyReport = catchAsyncError(async (req, res, next) => {
  if (!req.files || !req.files.file) {
    return next(new ErrorHandler("Please upload a file.", 400));
  }

  const file = req.files.file;

  if (!file.mimetype.startsWith("text/csv")) {
    return next(new ErrorHandler("Please upload a CSV file.", 400));
  }

  try {
    const userId = req.user.id;
    const s3Key = `uploads/${userId}/GenealogyReport.csv`;

    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.IMAGE_BUCKET,
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
        await GenealogyReport.deleteMany({userId});

        const filteredData = filterData(data);
        const filteredDataForLvl2 = filterDataForLvl2(data);
        const filteredDataForLvl1 = filterDataForLvl1(data);
        const filteredDataForBrandAmbassadors = filterDataForBrandAmbassadors(data);


        const totalPoints = filteredData.reduce((acc, row) => acc + parseInt(row.Points, 10), 0);
        const totalRowsForLvl1 = filteredDataForLvl1.length
        const totalRowsForLvl2 = filteredDataForLvl2.length
        const totalRowsForBrandAmbassadors = filteredDataForBrandAmbassadors.length

        try {
          const currentPointsReportData = filteredData.map((row) => ({
            Level: row.Level,
            PaidLevel: row.PaidLevel,
            Name: row.Name,
            ID: row.ID,
            City: row.City,
            State: row.State,
            Address: row.Address,
            Phone: row.Phone,
            Email: row.Email,
            SponsorID: row.SponsorID,
            SponsorName: row.SponsorName,
            CustomerType: row.CustomerType,
            HighestAchievedRank: row.HighestAchievedRank,
            PaidRank: row.PaidRank,
            Points: row.Points,
            PV: row.PV,
            NewAmbassadors: row.NewAmbassadors,
            CancelledAmbassadors: row.CancelledAmbassadors,
            WelcomePack: row.WelcomePack,
            OrgVolume: row.OrgVolume,
            JoinDate: row.JoinDate,
            UpgradeDate: row.UpgradeDate,
            RenewalDate: row.RenewalDate,
            CommissionQualified: row.CommissionQualified,
            NextSubscription: row.NextSubscription,
            SubscriptionStatusOn: row.SubscriptionStatusOn,
            SubscriptionPV: row.SubscriptionPV
          }));
          const vipCustomerLevel1Data = filteredDataForLvl1.map((row) => ({
            Level: row.Level,
            Name: row.Name,
            ID: row.ID,
            Phone: row.Phone,
            Email: row.Email,
            SponsorName: row.SponsorName,
            CustomerType: row.CustomerType,
            PV: row.PV,
            WelcomePack: row.WelcomePack,
            JoinDate: row.JoinDate,
            NextSubscription: row.NextSubscription,
            SubscriptionPV: row.SubscriptionPV
          }));
          const vipCustomerLevel2Data = filteredDataForLvl1.map((row) => ({
            Level: row.Level,
            Name: row.Name,
            ID: row.ID,
            Phone: row.Phone,
            Email: row.Email,
            SponsorName: row.SponsorName,
            CustomerType: row.CustomerType,
            PV: row.PV,
            WelcomePack: row.WelcomePack,
            JoinDate: row.JoinDate,
            NextSubscription: row.NextSubscription,
            SubscriptionPV: row.SubscriptionPV
          }));
          const newBrandAmbassadorsData = filteredDataForBrandAmbassadors.map((row) => ({
            Level: row.Level,
            Name: row.Name,
            ID: row.ID,
            Phone: row.Phone,
            Email: row.Email,
            SponsorName: row.SponsorName,
            CustomerType: row.CustomerType,
            PV: row.PV,
            WelcomePack: row.WelcomePack,
            JoinDate: row.JoinDate,
            UpgradeDate: row.UpgradeDate,
            NextSubscription: row.NextSubscription,
            SubscriptionPV: row.SubscriptionPV
          }));

          const genealogyReport = new GenealogyReport({
            currentPointsReport: currentPointsReportData,
            vipCustomerLevel1: vipCustomerLevel1Data,
            vipCustomerLevel2: vipCustomerLevel2Data,
            newBrandAmbassadors: newBrandAmbassadorsData,
            vipCustomerLevel1Count: totalRowsForLvl1,
            vipCustomerLevel2Count: totalRowsForLvl2,
            newBrandAmbassadorsCount: totalRowsForBrandAmbassadors,
            currentPoints: totalPoints,
            userId:req.user.id
          });

          await genealogyReport.save();

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

export const getGenealogyReportData = catchAsyncError(async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Find the PointsAndRankup document(s) - use findOne() if you expect a single document
    const report = await GenealogyReport.findOne({userId});
    if (!report || report.length === 0) {
      return next(new ErrorHandler("No data found.", 404));
    }

    // Assuming you have only one report for this example
    const currentPoints = report.currentPoints;
    const newVipsLvl1 = report.vipCustomerLevel1Count
    const newVipsLvl2 = report.vipCustomerLevel2Count
    const totalBrandAmbassadors = report.newBrandAmbassadorsCount;
    const currentPointsReport = report.currentPointsReport;
    const vipCustomerLevel1Report = report.vipCustomerLevel1;
    const vipCustomerLevel2Report = report.vipCustomerLevel2;
    const newBrandAmbassadorsReport = report.newBrandAmbassadors;


    res.status(200).json({
      success: true,
      currentPoints,
      newVipsLvl1,
      newVipsLvl2,
      totalBrandAmbassadors,
      currentPointsReport,
      vipCustomerLevel1Report,
      vipCustomerLevel2Report,
      newBrandAmbassadorsReport
    });
  } catch (error) {
    console.error("Error while retrieving data:", error);
    return next(new ErrorHandler("Error retrieving data.", 500));
  }
});
