<!-- Original path: ./README.md -->
# Bugsink AWS CDK

The below provides a developer oriented README - for a quickstart/tutorial to deploy Bugsink, see [setup](./SETUP.md).

This CDK project deploys an Bugsink monitoring instance on AWS EC2 with automatic DNS configuration using a single Docker Compose which embeds Caddy reverse proxy.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js and npm installed
- AWS CDK CLI installed (`npm install -g aws-cdk`)

## Setup

1. **Clone the repository and install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.dist .env
   ```

3. **Edit the `.env` file with your configuration:**

   ```bash
   # Your Route 53 hosted zone ID (found in AWS Console > Route 53 > Hosted zones)
   CDK_HOSTED_ZONE_ID=Z1234567890ABC

   # The domain name for your hosted zone (e.g., example.com)
   CDK_HOSTED_ZONE_DOMAIN_NAME=example.com

   # The subdomain where  Bugsink will be accessible (e.g. monitor )
   # This will create .example.com
   CDK_INSTANCE_SUBDOMAIN=monitor
   ```

## Deployment

1. **Bootstrap CDK (first time only):**

   ```bash
   npx cdk bootstrap
   ```

2. **Deploy the stack:**

   ```bash
   npx cdk deploy
   ```

3. **Access your Bugsink instance:**

   After deployment, your Bugsink instance will be available at:
   `https://{CDK_INSTANCE_SUBDOMAIN}.{CDK_HOSTED_ZONE_DOMAIN_NAME}`

## What Gets Deployed

- **VPC**: A new VPC with public and private subnets
- **EC2 Instance**: An EC2 instance running Bugsink
- **Elastic IP**: A static IP address for the instance
- **Route 53 Record**: DNS A record pointing to your instance
- **Security Groups**: Appropriate firewall rules for HTTP/HTTPS access

## Cleanup

To destroy all resources:

```bash
cdk destroy
```

## Troubleshooting

- Ensure your AWS credentials have the necessary permissions for EC2, VPC, Route 53, and CloudFormation
- Verify that your hosted zone exists and the domain is properly configured
- Check that the subdomain doesn't already exist in your hosted zone
