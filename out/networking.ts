// Original path: ./lib/components/networking.ts 
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

/**
 * Deploys a VPC for the EC2 instance to live in.
 */
export class Networking extends Construct {
  /** The VPC where the networking resources are created */
  public readonly vpc: IVpc;

  /**
   * @param scope The scope in which to define this construct
   * @param id The scoped construct ID
   * @param props Configuration properties
   */
  constructor(scope: Construct, id: string, _props: {}) {
    super(scope, id);

    // Setup basic VPC with some public subnet(s) as per default
    this.vpc = new Vpc(this, "vpc", {
      // Don't need a lot of AZs for this
      maxAzs: 1,
      // No need for nat gateways right now since no private subnet outbound
      // traffic
      natGateways: 0,
    });
  }
}
