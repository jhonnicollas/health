declare module '@hapi/boom' {
  export class Boom extends Error {
    output: { statusCode: number; payload: any; headers: Record<string, string> };
    constructor(message?: string, options?: any);
  }
}
