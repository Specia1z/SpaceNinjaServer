export interface IFeaturePackage {
    id: string;
    version: string;
    file: string;
    size: number;
    sha256: string;
    enabled?: boolean;
    capabilities?: string[];
    entrypoints?: string[];
    minGameVersion?: number;
    maxGameVersion?: number;
}

export interface IFeaturePackageManifest {
    schema: 1;
    features: IFeaturePackage[];
}
