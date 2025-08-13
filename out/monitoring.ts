// Original path: ./bin/monitoring.ts 
#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import * as dotenv from "dotenv";
import { z } from "zod";
import { MonitoringCdkStack } from "../lib/monitoring-stack";

// Load environment variables from .env file
dotenv.config();

// Build zod schema for environment variables
const envSchema = z.object({
  CDK_STACK_NAME: z.string().min(1, "CDK_STACK_NAME is required"),
  CDK_HOSTED_ZONE_ID: z.string().min(1, "CDK_HOSTED_ZONE_ID is required"),
  CDK_HOSTED_ZONE_DOMAIN_NAME: z
    .string()
    .min(1, "CDK_HOSTED_ZONE_DOMAIN_NAME is required"),
  CDK_BUGSINK_SUBDOMAIN: z.string().min(1, "CDK_BUGSINK_SUBDOMAIN is required"),
  CDK_UPTIME_SUBDOMAIN: z.string().min(1, "CDK_UPTIME_SUBDOMAIN is required"),
});

// Process the environment variables
const envConfig = envSchema.parse(process.env);

const app = new cdk.App();

new MonitoringCdkStack(app, envConfig.CDK_STACK_NAME, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  stackName: envConfig.CDK_STACK_NAME,
  hostedZoneId: envConfig.CDK_HOSTED_ZONE_ID,
  domainName: envConfig.CDK_HOSTED_ZONE_DOMAIN_NAME,
  bugsinkSubdomainName: envConfig.CDK_BUGSINK_SUBDOMAIN,
  uptimeSubdomainName: envConfig.CDK_UPTIME_SUBDOMAIN,
});
