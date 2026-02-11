import type { AppSpec } from '../types/appspec.js';
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare function validateAppSpec(appspec: AppSpec): ValidationResult;
//# sourceMappingURL=appspec-validator.d.ts.map