# Monitoring Stack AWS CDK

The below provides a developer oriented README - for a quickstart/tutorial to deploy the monitoring stack, see [setup](./SETUP.md).

This CDK project deploys an open-source monitoring solution on AWS EC2 that includes both [Bugsink](https://github.com/bugsink/bugsink) (error tracking) and [Uptime Kuma](https://github.com/louislam/uptime-kuma) (uptime monitoring) with automatic DNS configuration and SSL certificates using Docker Compose and Caddy reverse proxy.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js and npm installed
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- A Route 53 hosted zone for your domain

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
   # Stack name for CloudFormation
   CDK_STACK_NAME=monitoring-stack

   # Your Route 53 hosted zone ID (found in AWS Console > Route 53 > Hosted zones)
   CDK_HOSTED_ZONE_ID=Z1234567890ABC

   # The domain name for your hosted zone (e.g., example.com)
   CDK_HOSTED_ZONE_DOMAIN_NAME=example.com

   # The subdomain where Bugsink will be accessible (e.g., bugsink)
   # This will create bugsink.example.com
   CDK_BUGSINK_SUBDOMAIN=bugsink

   # The subdomain where Uptime Kuma will be accessible (e.g., uptime)
   # This will create uptime.example.com
   CDK_UPTIME_SUBDOMAIN=uptime
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

3. **Access your monitoring services:**

   After deployment, your services will be available at:

   - **Bugsink (Error Tracking)**: `https://{CDK_BUGSINK_SUBDOMAIN}.{CDK_HOSTED_ZONE_DOMAIN_NAME}`
   - **Uptime Kuma (Uptime Monitoring)**: `https://{CDK_UPTIME_SUBDOMAIN}.{CDK_HOSTED_ZONE_DOMAIN_NAME}`

   Login credentials for Bugsink are automatically generated and stored in AWS Secrets Manager.

## What Gets Deployed

- **VPC**: A new VPC with public subnet (single AZ for cost optimization)
- **EC2 Instance**: An EC2 instance (t3.small by default) running both monitoring services
- **Elastic IP**: A static IP address for the instance
- **Route 53 Records**: DNS A records for both subdomains pointing to your instance
- **Security Groups**: Firewall rules allowing HTTP (80) and HTTPS (443) access
- **AWS Secrets Manager**: Secure storage for database passwords and API keys
- **Docker Services**:
  - **Bugsink**: Error tracking and monitoring application
  - **Uptime Kuma**: Uptime monitoring dashboard
  - **MySQL**: Database for Bugsink
  - **Caddy**: Reverse proxy with automatic SSL certificate management

## Architecture

The deployed solution uses Docker Compose to coordinate multiple services:

- **Caddy** acts as a reverse proxy, automatically obtaining SSL certificates from Let's Encrypt
- **Bugsink** provides error tracking capabilities with Django backend
- **Uptime Kuma** offers uptime monitoring with a web-based dashboard
- **MySQL** serves as the database for Bugsink
- All services run on a single EC2 instance with persistent data storage

## Configuration

- Default instance: `t3.small` (can be customized)
- Default storage: 80GB EBS volume (can be customized)
- Automatic SSL certificate generation via Let's Encrypt
- Persistent data storage for databases and application data
- Systemd service for automatic startup and management

## Monitoring and Logs

Once deployed, you can monitor your services:

```bash
# SSH into the instance (using Session Manager)
aws ssm start-session --target <instance-id>

# Check service status
docker compose ps

# View logs
docker compose logs bugsink
docker compose logs uptime-kuma
docker compose logs caddy
docker compose logs mysql

# View installation logs
tail -f /home/ubuntu/user-data.log
```

## Cleanup

To destroy all resources:

```bash
cdk destroy
```

**Note**: This will permanently delete all data stored in the monitoring applications. Make sure to backup any important data before destroying the stack.

## Troubleshooting

- Ensure your AWS credentials have the necessary permissions for EC2, VPC, Route 53, Secrets Manager, and CloudFormation
- Verify that your hosted zone exists and the domain is properly configured
- Check that the subdomains don't already exist in your hosted zone
- SSL certificates may take a few minutes to generate after deployment
- Ensure DNS propagation is complete before accessing the services
- Check the user-data logs on the instance for deployment issues: `/home/ubuntu/user-data.log`

## Security Considerations

- Database credentials are automatically generated and stored securely in AWS Secrets Manager
- SSL certificates are automatically managed by Caddy
- The instance is accessible only via HTTPS (port 443) and HTTP (port 80, for Let's Encrypt challenges)
- Consider restricting access further by modifying security groups if needed
