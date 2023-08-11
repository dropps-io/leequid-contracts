const { Users } = require("../Users.class");
const prompts = require("prompts");

const users = new Users();

async function main() {
  let exit = false;

  while (!exit) {
    const response = await prompts({
      type: "select",
      name: "action",
      message: "What do you want to do?",
      choices: [
        { title: `${users.isRunning() ? "Stop" : "Start"}`, value: "toggleInterval" },
        { title: "New user", value: "newUser" },
        { title: "Users status", value: "statusUsers" },
        { title: "Exit all users", value: "exitAllUsers" },
        { title: "Claim and cashout all rewards", value: "claimAndCashoutAllRewards" },
        { title: "Claim and compound all rewards", value: "claimAndCompoundAllRewards" },
        { title: "Disable all users", value: "disableAllUsers" },
        { title: "Activate all users", value: "activateAllUsers" },
        { title: "Configuration", value: "config" },
        { title: "Exit", value: "exit" },
      ],
      initial: 0,
    });

    const action = response.action;

    if (action === "toggleInterval") {
      if (users.isRunning()) users.stop();
      else users.start();
    } else if (action === "statusUsers") {
      await users.usersStatus();
    } else if (action === "newUser") {
      await users.newUser();
    } else if (action === "activateAllUsers") {
      await users.activateAllUsers();
    } else if (action === "disableAllUsers") {
      await users.disableAllUsers();
    } else if (action === "claimAndCashoutAllRewards") {
      await users.claimAndCashoutAllRewards();
    } else if (action === "claimAndCompoundAllRewards") {
      await users.claimAndCashoutAllRewards(true);
    } else if (action === "exitAllUsers") {
      await users.exitAllUsers();
    } else if (action === "config") {
      await stakingConfig();
    } else if (action === "exit") {
      exit = true; // Exit the loop
    }
  }
}

async function stakingConfig() {
  let back = false;

  while (!back) {
    const response = await prompts({
      type: "select",
      name: "action",
      message: "Staking Configuration",
      choices: [
        { title: `Staking: ${users.staking}`, value: "toggleStaking" },
        { title: `Unstaking: ${users.unstaking}`, value: "toggleUnstaking" },
        { title: `Adding Liquidity: ${users.addingLiquidity}`, value: "toggleAddingLiquidity" },
        { title: `Cash out: ${users.cashingOut}`, value: "toggleCashout" },
        { title: `Compound: ${users.compouding}`, value: "toggleCompound" },
        { title: `Adding Liquidity: ${users.addingLiquidity}`, value: "toggleAddingLiquidity" },
        { title: "Set properties", value: "set" },
        { title: "Back", value: "back" },
      ],
      initial: 0,
    });

    const action = response.action;

    if (action === "toggleStaking") {
      users.stakingEnable(!users.staking);
    } else if (action === "toggleUnstaking") {
      users.unstakingEnable(!users.unstaking);
    } else if (action === "toggleAddingLiquidity") {
      users.addingLiquidityEnable(!users.addingLiquidity);
    } else if (action === "toggleCashout") {
      users.cashingOut = !users.cashingOut;
    } else if (action === "toggleCompound") {
      users.compouding = !users.compouding;
    } else if (action === "set") {
      await setProperties();
    } else if (action === "back") {
      back = true; // Exit the loop
    }
  }
}

async function setProperties() {
  const properties = Object.keys(users).filter((key) => typeof users[key] !== "function"); // Exclude methods

  const propertyResponse = await prompts({
    type: "select",
    name: "property",
    message: "Which property do you want to set?",
    choices: properties.map((prop) => ({ title: `${prop} : ${users[prop]}`, value: prop })),
    initial: 0,
  });

  const valueResponse = await prompts({
    type: "text",
    name: "value",
    message: `What is the new value for ${propertyResponse.property}?`,
  });

  await users.setProperty(propertyResponse.property, valueResponse.value);
}

main();
