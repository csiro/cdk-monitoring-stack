// Original path: ./lib/components/domains.ts 
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as route53 from "aws-cdk-lib/aws-route53";
import { CfnOutput, Stack } from "aws-cdk-lib";

export interface DomainsProps {
  /** The EC2 instance to associate with the domain */
  instance: ec2.Instance;
  /** The Elastic IP to use for the static IP address */
  eip: ec2.CfnEIP;
  /** The Route53 hosted zone ID where DNS records will be created */
  hostedZoneId: string;
  /** The root domain name (e.g., 'example.com') */
  domainName: string;
  /** The subdomain name for the Bugsink instance (e.g., 'bugsink') */
  bugsinkSubdomainName: string;
  /** The subdomain name for uptime monitoring (e.g., 'uptime') */
  uptimeSubdomainName: string;
}

/**
 * Creates DNS records to route traffic from a domain/subdomain to an EC2 instance
 * with a static IP address.
 */
export class Domains extends Construct {
  /** The full Bugsink domain name (subdomain + domain) */
  public readonly bugsinkFullDomainName: string;
  /** The full Uptime domain name (subdomain + domain) */
  public readonly uptimeFullDomainName: string;
  /** The Route53 A record for the Bugsink subdomain */
  public readonly bugsinkSubdomainRecord: route53.ARecord;
  /** The Route53 A record for the Uptime subdomain */
  public readonly uptimeSubdomainRecord: route53.ARecord;

  /**
   * @param scope The scope in which to define this construct
   * @param id The scoped construct ID
   * @param props Configuration properties for domain setup
   */
  constructor(scope: Construct, id: string, props: DomainsProps) {
    super(scope, id);
    const {
      instance,
      eip,
      hostedZoneId,
      domainName,
      uptimeSubdomainName,
      bugsinkSubdomainName,
    } = props;

    // Construct the full domain names
    this.bugsinkFullDomainName = `${bugsinkSubdomainName}.${domainName}`;
    this.uptimeFullDomainName = `${uptimeSubdomainName}.${domainName}`;

    // Get reference to the hosted zone
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        hostedZoneId: hostedZoneId,
        zoneName: domainName,
      }
    );

    // Create A record for the Bugsink subdomain pointing to the Elastic IP
    this.bugsinkSubdomainRecord = new route53.ARecord(
      this,
      "BugsinkSubdomainRecord",
      {
        zone: hostedZone,
        recordName: bugsinkSubdomainName,
        target: route53.RecordTarget.fromIpAddresses(eip.ref),
        comment: `A record for ${this.bugsinkFullDomainName} pointing to EC2 instance ${instance.instanceId}`,
      }
    );

    // Create A record for the Uptime subdomain pointing to the Elastic IP
    this.uptimeSubdomainRecord = new route53.ARecord(
      this,
      "UptimeSubdomainRecord",
      {
        zone: hostedZone,
        recordName: uptimeSubdomainName,
        target: route53.RecordTarget.fromIpAddresses(eip.ref),
        comment: `A record for ${this.uptimeFullDomainName} pointing to EC2 instance ${instance.instanceId}`,
      }
    );

    // Output the Bugsink domain name
    new CfnOutput(this, "BugsinkFullDomainName", {
      value: this.bugsinkFullDomainName,
      description:
        "The full Bugsink domain name that resolves to the EC2 instance",
      exportName: `${Stack.of(this).stackName}-BugsinkDomainName`,
    });

    // Output the Uptime domain name
    new CfnOutput(this, "UptimeFullDomainName", {
      value: this.uptimeFullDomainName,
      description:
        "The full Uptime domain name that resolves to the EC2 instance",
      exportName: `${Stack.of(this).stackName}-UptimeDomainName`,
    });
  }
}
