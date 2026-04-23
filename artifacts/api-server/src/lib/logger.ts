import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const betterStackToken = process.env.BETTER_STACK_SOURCE_TOKEN;
const betterStackEndpoint = "https://s2390604.eu-fsn-3.betterstackdata.com";

function buildTransport(): pino.TransportSingleOptions | pino.TransportMultiOptions | undefined {
  if (!isProduction) {
    return {
      target: "pino-pretty",
      options: { colorize: true },
    } as pino.TransportSingleOptions;
  }

  if (betterStackToken) {
    return {
      targets: [
        { target: "pino/file", options: { destination: 1 } },
        {
          target: "@logtail/pino",
          options: {
            sourceToken: betterStackToken,
            options: { endpoint: betterStackEndpoint },
          },
        },
      ],
    } as pino.TransportMultiOptions;
  }

  return undefined;
}

const transport = buildTransport();

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    redact: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "req.body.password",
      "req.body.currentPassword",
      "req.body.newPassword",
      "req.body.confirmPassword",
      "req.body.passwordHash",
      "*.password",
      "*.passwordHash",
    ],
  },
  transport ? pino.transport(transport) : undefined,
);
