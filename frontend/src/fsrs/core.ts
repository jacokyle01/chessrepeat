import { fsrs, generatorParameters } from "ts-fsrs";

//TODO should be customizable, in settings. 
const params = generatorParameters({
  request_retention: 0.9,     // target recall probability
  maximum_interval: 3650,     // days (10 years)
  enable_fuzz: true,          // adds small randomization
  enable_short_term: true,    // short-term learning steps
});

export const scheduler = fsrs(params);