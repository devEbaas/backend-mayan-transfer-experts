export interface AppConfig {
  app: {
    nodeEnv: string;
    port: number;
    apiPrefix: string;
    corsOrigin: string;
  };
  database: {
    url: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  log: {
    level: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
}
