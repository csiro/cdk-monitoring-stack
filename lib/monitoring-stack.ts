import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { Networking } from "./components/networking";
import { MonitoringInstance } from "./components/instance";
import { Domains } from "./components/domains";

export interface MonitoringCdkStackProps extends cdk.StackProps {
  hostedZoneId: string;
  domainName: string;
  uptimeSubdomainName: string;
  bugsinkSubdomainName: string;
}

export class MonitoringCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringCdkStackProps) {
    super(scope, id, props);

    // Setup VPC
    const { vpc } = new Networking(this, "Networking", {});

    // Deploy EC2 instance
    const { instance, eip } = new MonitoringInstance(this, "Instance", {
      vpc: vpc,
      domainName: props.domainName,
      bugsinkSubdomainName: props.bugsinkSubdomainName,
      uptimeSubdomainName: props.uptimeSubdomainName,
    });

    // Expose DNS route
    new Domains(this, "Domains", {
      instance,
      eip,
      hostedZoneId: props.hostedZoneId,
      domainName: props.domainName,
      uptimeSubdomainName: props.uptimeSubdomainName,
      bugsinkSubdomainName: props.bugsinkSubdomainName,
    });

    // Output the instance ID
    new cdk.CfnOutput(this, "InstanceId", {
      value: instance.instanceId,
      description: "The ID of the Monitoring EC2 instance",
      exportName: cdk.Stack.of(this).stackName + "MonitoringInstanceId",
    });
  }
}
