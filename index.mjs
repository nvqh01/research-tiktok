import os from "os";
import workerpool from "workerpool";

const pool = workerpool.pool("./report_source.mjs", {
  maxWorkers: os.cpus().length,
  minWorkers: 0,
  workerType: "thread",
});

(async () => {
  const countries = [
    // "india",
    // "thailand",
    "germany",
    // "united_kingdom",
    // "brazil",
    // "united_states",
  ];
  const tasks = [];

  //   for (let i = 0; i < 3; i++) {
  //     countries.forEach((country) => {
  //       tasks.push({ index: i + 1, country });
  //     });
  //   }

  // countries.forEach((country) => {
  //   tasks.push({ index: 5, country });
  // });

  // countries.forEach((country) => {
  //   tasks.push({ index: 4, country });
  // });

  countries.forEach((country) => {
    tasks.push({ index: 6, country });
  });

  await Promise.all(
    tasks.map(({ index, country }) => pool.exec("start", [index, country]))
  );

  console.log("Worker finishes tasks...");
  await pool.terminate();
})();
