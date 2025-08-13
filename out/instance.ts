// Original path: ./lib/components/instance.ts 
import { Stack } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface MonitoringInstanceProps {
  vpc: ec2.IVpc;
  instanceClass?: ec2.InstanceClass;
  instanceSize?: ec2.InstanceSize;
  ebsSize?: number;
  domainName: string;
  uptimeSubdomainName: string;
  bugsinkSubdomainName: string;
}

// Deafult instance size to use
const DEFAULT_INSTANCE_SIZE = ec2.InstanceSize.SMALL;

// Default EBS storage size to use
const DEFAULT_STORAGE_SIZE = 80;

const DEFAULT_INSTANCE_CLASS = ec2.InstanceClass.T3;
/**
 * Deploys an EC2 instance with BugSink, uptime-kuma and Caddy reverse proxy
 * with automatic TLS encryption.
 */
export class MonitoringInstance extends Construct {
  /** The VPC where the networking resources are created */
  public readonly vpc: ec2.IVpc;
  public instance: ec2.Instance;
  public eip: ec2.CfnEIP;
  public secret: secretsmanager.Secret;

  /**
   * @param scope The scope in which to define this construct
   * @param id The scoped construct ID
   * @param props Configuration properties
   */
  constructor(scope: Construct, id: string, props: MonitoringInstanceProps) {
    super(scope, id);

    const bugsinkFullDomain = `${props.bugsinkSubdomainName}.${props.domainName}`;
    const uptimeFullDomain = `${props.uptimeSubdomainName}.${props.domainName}`;

    const machineImage = ec2.MachineImage.lookup({
      // AMI: ami-010876b9ddd38475e
      name: "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-20250610",
    });

    // Create secrets for BugSink
    this.secret = new secretsmanager.Secret(this, "BugSinkSecrets", {
      description: "BugSink database and application secrets",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "admin" }),
        generateStringKey: "password",
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/\"\\",
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // Generate Django secret key
    const djangoSecret = new secretsmanager.Secret(this, "DjangoSecret", {
      description: "Django SECRET_KEY for BugSink",
      generateSecretString: {
        excludeCharacters: " %+~`#$&*()|[]{}:;<>?!'/\"\\",
        includeSpace: false,
        passwordLength: 50,
      },
    });

    // Role for EC2 to use
    const instanceRole = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });

    // Allow SSM connection
    instanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );

    // Allow reading secrets
    this.secret.grantRead(instanceRole);
    djangoSecret.grantRead(instanceRole);

    // Setup script!
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      // Redirect all output to log files for easy debugging
      "exec > >(tee -a /home/ubuntu/user-data.log) 2>&1",
      "echo 'Starting user data script execution at $(date)'",
      "",
      // Update system
      "echo 'Updating system packages...'",
      "sudo apt-get update -y",
      "sudo apt-get upgrade -y",
      "",
      // Install required packages
      "echo 'Installing required packages...'",
      "sudo apt-get install -y ca-certificates curl gnupg lsb-release unzip jq",
      "",
      // Install AWS CLI
      "echo 'Installing AWS CLI...'",
      "curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip'",
      "unzip awscliv2.zip",
      "sudo ./aws/install",
      "",
      // Install Docker
      "echo 'Installing Docker...'",
      "sudo mkdir -p /etc/apt/keyrings",
      "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg",
      'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null',
      "sudo apt-get update -y",
      "sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin",
      "",
      // Start and enable Docker
      "echo 'Starting Docker service...'",
      "sudo systemctl start docker",
      "sudo systemctl enable docker",
      "",
      // Add ubuntu user to docker group
      "echo 'Adding ubuntu user to docker group...'",
      "sudo usermod -aG docker ubuntu",
      "",
      // Create necessary directories
      "echo 'Creating shared application directories...'",
      "sudo mkdir -p /srv/caddy",
      "sudo chown -R ubuntu:ubuntu /srv/caddy",
      "",
      "echo 'Creating bugsink application directories...'",
      "sudo mkdir -p /srv/bugsink",
      "sudo chown -R ubuntu:ubuntu /srv/bugsink",
      "",
      "echo 'Creating uptime-kuma application directories...'",
      "sudo mkdir -p /srv/uptime",
      "sudo chown -R ubuntu:ubuntu /srv/uptime",
      "",
      // AWS Setup
      "echo 'Setting AWS region...'",
      `REGION=${Stack.of(this).region}`,
      "export AWS_DEFAULT_REGION=$REGION",
      "",
      // Retrieve secrets from AWS Secrets Manager
      "echo 'Retrieving secrets from AWS Secrets Manager...'",
      `DB_SECRET_ARN=${this.secret.secretArn}`,
      `DJANGO_SECRET_ARN=${djangoSecret.secretArn}`,
      `DB_SECRET=$(aws secretsmanager get-secret-value --secret-id $DB_SECRET_ARN --query SecretString --output text)`,
      `DJANGO_SECRET=$(aws secretsmanager get-secret-value --secret-id $DJANGO_SECRET_ARN --query SecretString --output text)`,
      "",
      // Parse secrets
      `DB_PASSWORD=$(echo $DB_SECRET | jq -r '.password')`,
      `DB_USERNAME=$(echo $DB_SECRET | jq -r '.username')`,
      "",
      // Compose setup
      "echo 'Creating docker-compose.yml file...'",
      "cd /home/ubuntu",
      "cat > docker-compose.yml << EOF",
      "networks:",
      "  default:",
      '    name: "proxy_network"',
      "",
      "services:",
      "  mysql:",
      "    image: mysql:latest",
      "    restart: unless-stopped",
      '    command: "--binlog_expire_logs_seconds=3600"',
      "    environment:",
      '      MYSQL_ROOT_PASSWORD: "$DB_PASSWORD"',
      "      MYSQL_DATABASE: bugsink",
      "    volumes:",
      "      - /srv/bugsink/mysql:/var/lib/mysql",
      "    healthcheck:",
      '      test: ["CMD-SHELL", "exit | mysql -h localhost -P 3306 -u root -p$DB_PASSWORD"]',
      "      interval: 1s",
      "      timeout: 20s",
      "      retries: 30",
      "",
      "  bugsink:",
      "    image: bugsink/bugsink",
      "    depends_on:",
      "      mysql:",
      "        condition: service_healthy",
      "    restart: unless-stopped",
      "    environment:",
      '      SECRET_KEY: "$DJANGO_SECRET"',
      '      CREATE_SUPERUSER: "$DB_USERNAME:$DB_PASSWORD"',
      "      PORT: 8000",
      '      DATABASE_URL: "mysql://root:$DB_PASSWORD@mysql:3306/bugsink"',
      '      BEHIND_HTTPS_PROXY: "true"',
      `      BASE_URL: "https://${bugsinkFullDomain}"`,
      "    volumes:",
      "      - /srv/bugsink/data:/app/data",
      "    healthcheck:",
      `      test: ["CMD-SHELL", "python -c 'import requests; requests.get(\\"http://localhost:8000/\\").raise_for_status()'"]`,
      "      interval: 5s",
      "      timeout: 20s",
      "      retries: 10",
      "    labels:",
      `      caddy: ${bugsinkFullDomain}`,
      '      caddy.reverse_proxy: "* {{upstreams 8000}}"',
      "      caddy.header: |",
      "        /api/* X-Forwarded-Proto https",
      "        /api/* X-Forwarded-For {remote_host}",
      "",
      "  uptime-kuma:",
      "    image: louislam/uptime-kuma:1",
      "    restart: unless-stopped",
      "    volumes:",
      "      - /srv/uptime:/app/data",
      "    labels:",
      `      caddy: ${uptimeFullDomain}`,
      '      caddy.reverse_proxy: "* {{upstreams 3001}}"',
      "",
      "  caddy:",
      '    image: "lucaslorentz/caddy-docker-proxy:ci-alpine"',
      "    ports:",
      '      - "80:80"',
      '      - "443:443"',
      "    volumes:",
      "      - /var/run/docker.sock:/var/run/docker.sock:ro",
      "      - /srv/caddy/:/data",
      "    restart: unless-stopped",
      "    environment:",
      "      - CADDY_INGRESS_NETWORKS=proxy_network",
      "EOF",
      "",
      // Substitute environment variables in docker-compose.yml
      "echo 'Substituting environment variables...'",
      "envsubst < docker-compose.yml > docker-compose-final.yml",
      "mv docker-compose-final.yml docker-compose.yml",
      "",
      // Set proper ownership
      "sudo chown ubuntu:ubuntu docker-compose.yml",
      "",
      // Wait for docker to be fully ready and refresh group membership
      "echo 'Waiting for Docker to be ready...'",
      "sleep 10",
      "",
      // Start the services
      "echo 'Starting BugSink, MySQL, and Caddy services...'",
      "docker compose up -d",
      "",
      // Wait for services to start
      "echo 'Waiting for services to start...'",
      "sleep 30",
      "",
      // Create systemd service for BugSink
      "echo 'Creating systemd service for app monitoring...'",
      "sudo tee /etc/systemd/system/appmonitoring.service > /dev/null << 'EOF'",
      "[Unit]",
      "Description=Monitoring and Error Tracking",
      "Requires=docker.service",
      "After=docker.service",
      "",
      "[Service]",
      "Type=oneshot",
      "RemainAfterExit=yes",
      "WorkingDirectory=/home/ubuntu",
      "ExecStart=/usr/bin/docker compose up -d",
      "ExecStop=/usr/bin/docker compose down",
      "User=ubuntu",
      "Group=docker",
      "",
      "[Install]",
      "WantedBy=multi-user.target",
      "EOF",
      "",
      // Enable and start the service
      "echo 'Enabling appmonitoring service...'",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable appmonitoring.service",
      "",
      // Clean up sensitive variables
      "unset DB_SECRET",
      "unset DJANGO_SECRET",
      "unset DB_PASSWORD",
      "unset DB_USERNAME",
      "",

      // Final status and completion message
      "echo ''",
      "echo '================================================'",
      "echo 'User data script completed successfully!'",
      "echo '================================================'",
      "echo 'BugSink should be available at:'",
      `echo 'https://${bugsinkFullDomain}'`,
      "echo 'Uptime Kuma should be available at:'",
      `echo 'https://${uptimeFullDomain}'`,
      "echo ''",
      "echo 'Login credentials are stored in AWS Secrets Manager:'",
      `echo '  Secret ARN: ${this.secret.secretArn}'`,
      "echo '  Username: admin'",
      "echo '  Password: (stored in secret)'",
      "echo ''",
      "echo 'Available commands:'",
      "echo '  tail -f user-data.log - View this installation log'",
      "echo '  ./health-check.sh - Check service status'",
      "echo '  docker compose logs - View container logs'",
      "echo '  docker compose ps - View container status'",
      "echo ''",
      "echo 'Log files:'",
      "echo '  /home/ubuntu/user-data.log - This installation log'",
      "echo '  docker compose logs uptime-kuma - Uptime kuma logs'",
      "echo '  docker compose logs bugsink - BugSink logs'",
      "echo '  docker compose logs mysql - MySQL logs'",
      "echo '  docker compose logs caddy - Caddy logs'",
      "echo ''",
      "echo 'Note: SSL certificate will be automatically obtained by Caddy'",
      "echo 'Make sure DNS is pointing to this instance before accessing'",
      "echo ''",
      `echo 'User data script execution completed at $(date)'`
    );

    // Create HTTPS/HTTP security group
    const webSecurityGroup = new ec2.SecurityGroup(this, "web-sg", {
      vpc: props.vpc,
      allowAllOutbound: true,
      description:
        "Security group to allow inbound HTTP/HTTPS access for BugSink and uptime-kuma.",
    });

    // Add Let's Encrypt access (required for SSL certificate generation)
    webSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Lets Encrypt HTTP-01 Challenge requires inbound 80 on all IPv4 addresses"
    );
    webSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "HTTPS Public Access - general HTTPS network access to BugSink and uptime-kuma"
    );

    // Deploy an EC2 instance in the provided VPC
    this.instance = new ec2.Instance(this, "Instance", {
      // Networking
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      allowAllOutbound: true,
      associatePublicIpAddress: true,
      // Instance config
      instanceType: ec2.InstanceType.of(
        props.instanceClass ?? DEFAULT_INSTANCE_CLASS,
        props.instanceSize ?? DEFAULT_INSTANCE_SIZE
      ),
      machineImage,
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(
            props.ebsSize ?? DEFAULT_STORAGE_SIZE
          ),
        },
      ],
      // Permissions
      role: instanceRole,
      userData: userData,
    });

    // Add security group to instance to allow inbound from VPN addresses
    this.instance.addSecurityGroup(webSecurityGroup);

    // Create a static EIP for the instance
    this.eip = new ec2.CfnEIP(this, "eip", {
      domain: "vpc",
      instanceId: this.instance.instanceId,
    });
  }
}
