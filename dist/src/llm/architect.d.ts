export interface Message {
    role: 'user' | 'assistant';
    content: string;
}
export interface ArchitectResult {
    diagram: string | null;
    explanation: string;
    rawContent: string;
}
export declare function generateArchitecture(description: string, conversationHistory: Message[]): Promise<ArchitectResult>;
//# sourceMappingURL=architect.d.ts.map