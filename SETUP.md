# Monitoring Stack AWS CDK Tutorial

This tutorial will guide you through deploying your own monitoring solution on AWS using the Monitoring Stack AWS CDK project.

### What is This Monitoring Stack?

This monitoring stack includes two open-source tools:

- **Bugsink**: An error tracking and monitoring application that helps you capture, analyze, and resolve errors in your applications. It provides detailed error reports and stack traces.
- **Uptime Kuma**: A popular uptime monitoring tool that allows you to monitor the availability of your websites, services, and APIs, and sends you notifications when something goes down.

### What We'll Be Doing

In this tutorial, we will:

1. **Configure the project** with your own domain information.
2. **Deploy the stack** to your AWS account using the AWS CDK.
3. **Access your new monitoring services** and set them up.

### 1. Prerequisites

Before you begin, make sure you have the following set up:

- An AWS account
- A registered domain name with a Hosted Zone in Amazon Route 53
- AWS CLI configured with credentials that have `IAMPowerUserAccess` permissions
- Node.js (v18 or later) installed globally. You can use Node Version Manager (nvm) to manage your Node.js versions
- AWS CDK CLI installed, either globally with: `npm install -g aws-cdk`, or in this project which can be used as: `npx cdk`

### 2. Project Setup and Configuration

After cloning this repository, to ensure you are using a compatible version of Node.js, you can use `nvm`:

```bash
nvm use 20
```

If you don't have this version of Node.js installed, `nvm` will prompt you to install it. Next, install the project's dependencies:

```bash
npm install
```

This will install the AWS CDK and all other required packages for the project.

Next, create your environment configuration file by copying the provided template:

```bash
cp .env.dist .env
```

Now, open the `.env` file in your favorite editor. You'll need to provide five values:

- **`CDK_STACK_NAME`**: A name for your CloudFormation stack (e.g., `monitoring-stack`)
- **`CDK_HOSTED_ZONE_ID`**: This is the unique identifier for your domain's Hosted Zone in Route 53. You can find this in the AWS Console by navigating to **Route 53 > Hosted zones** and selecting your domain. The Hosted zone ID will be listed in the details.
- **`CDK_HOSTED_ZONE_DOMAIN_NAME`**: This is the domain name you have registered and configured in Route 53 (e.g., `example.com`).
- **`CDK_BUGSINK_SUBDOMAIN`**: This is the subdomain you want to use for your Bugsink instance (e.g., `errors` or `bugsink`). This will result in the URL `errors.example.com`.
- **`CDK_UPTIME_SUBDOMAIN`**: This is the subdomain you want to use for your Uptime Kuma instance (e.g., `status` or `uptime`). This will result in the URL `status.example.com`.

Here's an example of a completed `.env` file:

```
CDK_STACK_NAME=monitoring-stack
CDK_HOSTED_ZONE_ID=Z0123456789ABCDEFGHI
CDK_HOSTED_ZONE_DOMAIN_NAME=my-awesome-domain.com
CDK_BUGSINK_SUBDOMAIN=errors
CDK_UPTIME_SUBDOMAIN=status
```


### 3. Deploying the Stack

With the configuration in place, it's time to deploy the stack to your AWS account.

First, if this is your first time using CDK in this AWS account/region, you'll need to bootstrap it:

```bash
npx cdk bootstrap
```

Before deploying, it's always a good practice to see what changes the CDK is about to make. You can do this with the `diff` command:

```bash
npx cdk diff
```

This will show you all of the AWS resources that will be created. You should see a new VPC, EC2 instance, Elastic IP, Route 53 records, Security Groups, and Secrets Manager secrets, among other things.

Once you've reviewed the changes and are ready to proceed, deploy the stack:

```bash
npx cdk deploy
```

The CDK will ask for confirmation before it starts creating the resources. Type `y` and press Enter to approve the deployment.

### 4. Accessing Your Monitoring Services

The deployment process will take a few minutes. You can monitor the progress in your terminal or in the AWS CloudFormation console.

Once the deployment is complete, both of your monitoring services will be live!

#### Accessing Bugsink (Error Tracking)

Open your web browser and navigate to:
`https://<your-bugsink-subdomain>.<your-domain-name>`

For example: `https://errors.my-awesome-domain.com`

**Login Credentials**: The login credentials for Bugsink are automatically generated and stored securely in AWS Secrets Manager. To retrieve them:

1. Go to the AWS Console > Secrets Manager
2. Find the secret named something like `MonitoringStack-BugSinkSecrets-...`
3. Click "Retrieve secret value" to see the username and password
4. Use these credentials to log into Bugsink

#### Accessing Uptime Kuma (Uptime Monitoring)

Open your web browser and navigate to:
`https://<your-uptime-subdomain>.<your-domain-name>`

For example: `https://status.my-awesome-domain.com`

You will be greeted with the Uptime Kuma setup screen. Here, you'll create your administrator account:

1. Enter a username and password
2. Click **Create**

### 5. What's Running

Your EC2 instance is now running several Docker containers:

- **Bugsink**: Error tracking application accessible at your Bugsink subdomain
- **Uptime Kuma**: Uptime monitoring accessible at your Uptime subdomain
- **MySQL**: Database backend for Bugsink
- **Caddy**: Reverse proxy that automatically handles SSL certificates for both services

All services start automatically when the instance boots, and SSL certificates are automatically obtained and renewed by Caddy.

### 6. Monitoring Your Stack

You can monitor the health of your services by:

- **Checking service status**: Use AWS Systems Manager Session Manager to connect to your instance and run `docker compose ps`
- **Viewing logs**: Run `docker compose logs <service-name>` to view logs for specific services
- **Installation logs**: Check `/home/ubuntu/user-data.log` for deployment logs

### 7. Next Steps

Now that your monitoring stack is deployed:

1. **Configure Bugsink**: Set up your applications to send error reports to your Bugsink instance
2. **Set up monitors in Uptime Kuma**: Add your websites and services to monitor their uptime
3. **Configure notifications**: Set up email, Slack, or other notification channels in Uptime Kuma

### Cleaning Up

When you no longer need your monitoring stack, you can easily remove all the resources that were created by running:

```bash
npx cdk destroy
```

**Important**: This will delete the entire stack and all monitoring data. Make sure to backup any important data before destroying the stack.

### Troubleshooting

- **SSL Certificate Issues**: SSL certificates are automatically generated by Caddy, but this requires your DNS to be properly configured and propagated
- **Service Not Starting**: Check the user-data logs at `/home/ubuntu/user-data.log` on the EC2 instance
- **Can't Access Services**: Ensure your security groups allow traffic on ports 80 and 443, and that DNS has propagated
- **Database Connection Issues**: Database credentials are automatically generated and injected into the containers

For more detailed troubleshooting, connect to your instance using AWS Systems Manager Session Manager and check the Docker container logs.
