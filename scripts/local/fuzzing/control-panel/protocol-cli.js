const { Protocol } = require("../Protocol.class");
const prompts = require("prompts");

const protocol = new Protocol();

async function main() {
  const { action } = await prompts([
    {
      type: "select",
      name: "action",
      message: "What do you want to do?",
      choices: [
        { title: "Set Protocol Fee", value: "setProtocolFee" },
        { title: "Set Min Activating Deposit", value: "setMinActivatingDeposit" },
        { title: "Set Pending Validators Limit", value: "setPendingValidatorsLimit" },
        { title: "Exit", value: "exit" },
      ],
    },
  ]);

  switch (action) {
    case "setProtocolFee": {
      const { fee } = await prompts({
        type: "number",
        name: "fee",
        message: "Enter the new protocol fee:",
      });
      await protocol.setProtocolFee(fee);
      break;
    }
    case "setMinActivatingDeposit": {
      const { amount } = await prompts({
        type: "number",
        name: "amount",
        message: "Enter the new min activating deposit:",
      });
      await protocol.setMinActivatingDeposit(amount);
      break;
    }
    case "setPendingValidatorsLimit": {
      const { limit } = await prompts({
        type: "number",
        name: "limit",
        message: "Enter the new pending validators limit:",
      });
      await protocol.setPendingValidatorsLimit(limit);
      break;
    }
    case "exit": {
      process.exit(0);
    }
  }

  main();
}

main();
