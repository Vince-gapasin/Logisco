import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // e.g., https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});