const { MockChain } = require("../MockChain.class");
const prompts = require("prompts");

const mockChain = new MockChain();

async function main() {
  const response = await prompts({
    type: "select",
    name: "value",
    message: "What action do you want to perform?",
    choices: [
      { title: "Initialize", value: "initialize" },
      { title: "Start", value: "start" },
      { title: "Stop", value: "stop" },
      { title: "Exit", value: "exit" },
      { title: "Toggle rewards", value: "rewards" },
    ],
    initial: 0,
  });

  const action = response.value;

  if (action === "initialize") {
    await mockChain.initialize();
  } else if (action === "start") {
    mockChain.start();
  } else if (action === "stop") {
    await mockChain.stop();
  } else if (action === "rewards") {
    mockChain.rewardsEnabled = !mockChain.rewardsEnabled;
    console.log(`Rewards enabled: ${mockChain.rewardsEnabled}`);
  } else {
    process.exit(0);
  }

  // Go back to main menu
  main();
}

main();
