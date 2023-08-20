import {S3Client,DeleteObjectCommand,PutObjectCommand,GetObjectCommand,} from "@aws-sdk/client-s3";
import dotenv from "dotenv"
dotenv.config()

 const s3 = new S3Client({
  region: process.env.P_AWS_REGION, 
  credentials: {
      accessKeyId: process.env.P_AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.P_AWS_SECRET_ACCESS_KEY,
  },
});

export default s3