export function createChildPacket(spec: unknown): Promise<unknown>;

export interface LegacyRunInput {
  readonly spec: unknown;
  readonly outputDir: string;
  readonly codexBinary?: string | undefined;
  readonly codexArgs?: readonly string[] | undefined;
}

export function runGovernedChild(input: LegacyRunInput): Promise<unknown>;
