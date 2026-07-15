import { REFERRAL_PAIRS, type DriverProfile, type PartnerReferral } from '../types';

export interface InterventionScenario {
  prompt: string;
  choices: readonly [string, string];
  answer: 0 | 1;
  why: string;
}

export interface ReferralScenario {
  profile: DriverProfile;
  prompt: string;
  correctPartner: PartnerReferral;
  why: string;
}

export const INTERVENTION_SCENARIOS: Record<'Restraints' | 'Distractions', readonly InterventionScenario[]> = {
  Restraints: [
    {
      prompt: 'A rear passenger unclips their belt to settle a distressed child while the car is moving. What best reduces the immediate risk?',
      choices: ['Find a safe place to stop, settle the child, then check that everyone is restrained before moving again.', 'Ask the passenger to brace carefully until the next planned stop so traffic flow is not disrupted.'],
      answer: 0,
      why: 'Stopping safely removes the moving-vehicle risk and allows every restraint to be checked before the journey resumes.',
    },
    {
      prompt: 'A child restraint moves noticeably at its mounting point, but the driver says the destination is only two streets away. What is the stronger intervention?',
      choices: ['Tighten the harness and keep the remaining trip below the speed limit.', 'Pause the trip and have the restraint installation and harness fit checked before continuing.'],
      answer: 1,
      why: 'A correctly fitted restraint matters on every trip; reducing speed does not correct an insecure installation.',
    },
    {
      prompt: 'A passenger has routed the shoulder belt behind their back because it rubs their neck. What should happen next?',
      choices: ['Reposition the seat or belt correctly and resolve any fit problem before the vehicle moves.', 'Keep the lap section fastened and suggest restoring the shoulder section on faster roads.'],
      answer: 0,
      why: 'Both parts of the belt are designed to manage crash forces; comfort should be addressed without defeating the restraint.',
    },
    {
      prompt: 'There are five occupants but only four usable seating positions with restraints. Which plan best manages the risk?',
      choices: ['Seat the smallest passenger between two belted adults for the short trip.', 'Arrange another vehicle or an additional trip so every occupant has their own usable restraint.'],
      answer: 1,
      why: 'Sharing a seating position does not provide crash protection. Every occupant needs an appropriate, usable restraint.',
    },
    {
      prompt: 'A pregnant passenger has placed the lap belt across the abdomen because it feels more secure. Which guidance is safer?',
      choices: ['Place the lap belt low across the hips and the shoulder belt across the chest, adjusting the seat for comfort.', 'Keep the belt where it feels firmest and recline the seat to reduce pressure.'],
      answer: 0,
      why: 'Correct belt position helps spread crash forces through stronger parts of the body while retaining full restraint protection.',
    },
    {
      prompt: 'A buckle intermittently releases when the occupant shifts. The driver has tied the belt webbing to hold it closed. What is the safer response?',
      choices: ['Use the tied belt only for the direct trip to a repairer.', 'Do not use that seating position until the restraint has been properly repaired.'],
      answer: 1,
      why: 'An improvised fastening cannot be relied on in a crash; the defective position should be taken out of use.',
    },
    {
      prompt: 'A child appears to have outgrown their current restraint, but the adult wants to move them straight to an adult belt. What should guide the decision?',
      choices: ['Use the restraint limits and the child\'s belt fit, arranging an appropriate next-stage restraint if the adult belt does not fit correctly.', 'Move to the adult belt once the current harness looks snug, because age is the main test.'],
      answer: 0,
      why: 'Restraint limits and actual belt fit provide a safer basis than age or appearance alone.',
    },
    {
      prompt: 'Bulky luggage forces a rear passenger to sit forward so their belt no longer lies flat. What is the best correction?',
      choices: ['Have the passenger hold the load steady and keep the belt loosely fastened.', 'Repack or remove the load so the passenger can sit normally with the belt flat and correctly positioned.'],
      answer: 1,
      why: 'Cargo should not compromise seating posture or belt geometry, and unsecured load can add another hazard in a sudden stop.',
    },
    {
      prompt: 'An adult passenger says a medical condition makes the standard belt position painful. What is the most responsible next step?',
      choices: ['Stop safely, adjust the seating and belt without defeating it, and seek appropriate professional advice if safe use remains difficult.', 'Allow the passenger to travel unrestrained today and ask them to bring supporting information next time.'],
      answer: 0,
      why: 'The immediate journey still needs a safe arrangement; a genuine fit problem should be addressed rather than informally waived.',
    },
    {
      prompt: 'A sleeping passenger has slumped under the shoulder belt while the lap section remains fastened. Which response best manages the risk?',
      choices: ['Continue gently because waking them could create another distraction.', 'Stop when safe and restore an upright seating position with the belt correctly routed.'],
      answer: 1,
      why: 'Poor posture can undermine restraint performance; stopping safely is preferable to carrying that risk forward.',
    },
    {
      prompt: 'A thick winter coat leaves a child harness apparently tight but compressible. What is the safer approach?',
      choices: ['Check the restraint guidance, remove or open bulky layers as needed, and refit the harness close to the child.', 'Tighten the harness over the coat until no webbing can be pinched and leave the coat zipped.'],
      answer: 0,
      why: 'Bulky layers can create hidden slack. Following the restraint guidance preserves both fit and warmth safely.',
    },
    {
      prompt: 'An adult has clipped the belt in but is sitting on the lap section to silence the reminder. What response is most likely to change future behaviour?',
      choices: ['Record that the buckle was engaged and focus the conversation on the reminder system.', 'Make the ineffective belt use explicit, require correct routing before departure, and explain why a clicked buckle alone is not protection.'],
      answer: 1,
      why: 'The intervention should address the actual protective behaviour, not merely whether the buckle sensor was satisfied.',
    },
  ],
  Distractions: [
    {
      prompt: 'Navigation reroutes unexpectedly in dense traffic. The phone is mounted, but the new route needs several taps. What is the safer choice?',
      choices: ['Continue on the current road until a passenger can help or the driver can stop safely to change it.', 'Use the next red light to enter the route because the vehicle will not be moving.'],
      answer: 0,
      why: 'A short detour is safer than moving attention and hands to a device while still responsible for traffic conditions.',
    },
    {
      prompt: 'A hands-free work call becomes tense and requires detailed decisions on a wet motorway. What best manages the distraction?',
      choices: ['Reduce speed slightly and continue because both hands remain on the wheel.', 'End or defer the call until the driver is safely stopped and can give it full attention.'],
      answer: 1,
      why: 'Hands-free does not remove cognitive distraction, especially when road conditions already demand more attention.',
    },
    {
      prompt: 'A smartwatch vibrates with a message while the driver is approaching a pedestrian crossing. What is the safest response?',
      choices: ['Leave it unread and keep attention on the crossing until the journey is safely paused.', 'Glance at the preview without touching it, then decide whether a reply is needed.'],
      answer: 0,
      why: 'The crossing is the immediate safety task; even a glance can displace observation at the wrong moment.',
    },
    {
      prompt: 'Two children begin arguing loudly in the back seat and one unclips their belt. What should the driver do?',
      choices: ['Use the mirror to manage them while slowing down and continuing to the destination.', 'Keep control of the road, then stop at the first safe place to resolve the argument and restore the restraint.'],
      answer: 1,
      why: 'Stopping safely separates the driving task from the cabin problem and allows the restraint issue to be fixed properly.',
    },
    {
      prompt: 'A hot drink spills near the pedals on a busy road. Which response best protects control of the vehicle?',
      choices: ['Maintain control, find a safe place to stop, then deal with the spill.', 'Hold the wheel with one hand and move the cup before liquid reaches the pedals.'],
      answer: 0,
      why: 'The first priority is a predictable vehicle path; the spill can be handled once driving has safely stopped.',
    },
    {
      prompt: 'A passenger wants to show the driver an important photo while they are negotiating a roundabout. What is the best response?',
      choices: ['Ask the passenger to hold it near the windscreen so the driver can glance without turning.', 'Defer the photo until the vehicle is parked and keep visual attention on the roundabout.'],
      answer: 1,
      why: 'Moving the display does not remove the visual and cognitive distraction during a high-demand manoeuvre.',
    },
    {
      prompt: 'The mounted phone falls into the passenger footwell but voice guidance continues. What should the driver do?',
      choices: ['Leave it where it is and stop safely before retrieving or remounting it.', 'Reach for it only on a straight section while using lane markings as a guide.'],
      answer: 0,
      why: 'Reaching away from the driving position compromises vision and control; the device can wait for a safe stop.',
    },
    {
      prompt: 'Voice-to-text allows a driver to answer a complicated message without touching the phone. What is the safer plan?',
      choices: ['Dictate slowly so the system makes fewer errors and less correction is needed.', 'Defer the message or stop safely, because composing it still occupies attention needed for driving.'],
      answer: 1,
      why: 'Removing manual input does not remove the mental workload of composing and checking a detailed message.',
    },
    {
      prompt: 'Music is unexpectedly loud as traffic compresses ahead. The steering wheel has audio controls. What should take priority?',
      choices: ['Respond to the changing traffic first, then adjust the audio when conditions are stable.', 'Turn it down immediately with the wheel control so the noise cannot mask hazards.'],
      answer: 0,
      why: 'A familiar control is still a secondary task; the developing traffic hazard needs uninterrupted attention first.',
    },
    {
      prompt: 'A loose pet climbs toward the driver while the vehicle is moving. Which response best manages the risk?',
      choices: ['Have a passenger hold the pet while the driver continues at reduced speed.', 'Keep control, stop safely, and secure the pet before continuing.'],
      answer: 1,
      why: 'A properly secured pet is less likely to interfere again or become a projectile during sudden braking.',
    },
    {
      prompt: 'An emergency alert sounds on several phones in the vehicle during a complex intersection approach. What should the driver do first?',
      choices: ['Complete the driving task safely, then stop or ask a passenger to read the alert.', 'Read the first line on the mounted display to decide whether the route must change immediately.'],
      answer: 0,
      why: 'The intersection demands immediate control and observation; a passenger or safe stop can handle the alert without competing for attention.',
    },
    {
      prompt: 'The driver slows beside a roadside crash and turns to see whether help is needed while traffic ahead keeps moving. What is safer?',
      choices: ['Slow further and inspect the scene carefully before deciding whether to stop.', 'Maintain observation of the traffic path and, if help may be needed, pull over safely before assessing or calling.'],
      answer: 1,
      why: 'Looking away while still moving can create a second incident; stopping safely allows a deliberate response.',
    },
  ],
};

export const PARTNER_FOCUS: Record<PartnerReferral, string> = {
  ACC: 'injury-prevention education and behaviour support',
  'Waka Kotahi': 'licensing, driver-system, and road-safety support',
  'Community Patrols': 'local visibility and community follow-up',
};

export const REFERRAL_SCENARIOS: readonly ReferralScenario[] = [
  {
    profile: 'Repeat Offender',
    prompt: 'Several recent stops show the same unsafe pattern despite prior roadside conversations. Which exercise partner best supports a system-level follow-up?',
    correctPartner: REFERRAL_PAIRS['Repeat Offender'],
    why: 'The exercise routes repeated patterns toward driver-system and road-safety support rather than treating each stop as isolated.',
  },
  {
    profile: 'Young Driver',
    prompt: 'A new driver understands the rule but underestimates how quickly a low-speed mistake can cause injury. Which exercise partner best fits prevention education?',
    correctPartner: REFERRAL_PAIRS['Young Driver'],
    why: 'The exercise pairs an emerging driver with injury-prevention education and practical behaviour support.',
  },
  {
    profile: 'Tired Driver',
    prompt: 'A rural worker repeatedly drives home fatigued after late shifts and has few local transport options. Which exercise partner best fits community follow-up?',
    correctPartner: REFERRAL_PAIRS['Tired Driver'],
    why: 'The exercise uses local follow-up to reinforce safer choices beyond a single roadside conversation.',
  },
  {
    profile: 'Repeat Offender',
    prompt: 'The same licence holder appears across multiple speed interventions in different districts. Which exercise partner best addresses the recurring pattern?',
    correctPartner: REFERRAL_PAIRS['Repeat Offender'],
    why: 'A recurring cross-district pattern calls for the exercise\'s driver-system support pathway.',
  },
  {
    profile: 'Young Driver',
    prompt: 'A restricted driver describes strong peer pressure to answer messages and keep pace with faster friends. Which exercise partner best supports early behaviour change?',
    correctPartner: REFERRAL_PAIRS['Young Driver'],
    why: 'Injury-prevention education can connect peer-pressure decisions with their real consequences before the pattern becomes established.',
  },
  {
    profile: 'Tired Driver',
    prompt: 'A delivery driver reports microsleeps near the end of a regular local route. Which exercise partner best supports ongoing community visibility and follow-up?',
    correctPartner: REFERRAL_PAIRS['Tired Driver'],
    why: 'The exercise assigns a locally recurring fatigue concern to the community follow-up pathway.',
  },
  {
    profile: 'Repeat Offender',
    prompt: 'Previous education was understood, but the driver continues to carry unrestrained passengers. Which exercise partner best fits the repeated behaviour?',
    correctPartner: REFERRAL_PAIRS['Repeat Offender'],
    why: 'Understanding without behaviour change makes this a repeated-pattern referral in the exercise.',
  },
  {
    profile: 'Young Driver',
    prompt: 'A learner driver had a near miss while adjusting music and wants strategies for managing passengers and devices. Which exercise partner is the closest fit?',
    correctPartner: REFERRAL_PAIRS['Young Driver'],
    why: 'The exercise links early coaching and injury prevention to safer habits before solo driving patterns settle.',
  },
  {
    profile: 'Tired Driver',
    prompt: 'An older resident makes frequent dawn trips and says there is nobody nearby to check in when they are too tired to drive. Which exercise partner best fits?',
    correctPartner: REFERRAL_PAIRS['Tired Driver'],
    why: 'The stated need is local connection and follow-up, matching the exercise\'s community pathway.',
  },
  {
    profile: 'Repeat Offender',
    prompt: 'A driver alternates between speeding and phone use, with each stop treated as a separate event. Which exercise partner best supports a joined-up response?',
    correctPartner: REFERRAL_PAIRS['Repeat Offender'],
    why: 'The exercise uses driver-system support to address the overall pattern rather than one offence category at a time.',
  },
  {
    profile: 'Young Driver',
    prompt: 'A newly licensed driver is receptive after a restraint stop but has little understanding of crash forces. Which exercise partner best reinforces the lesson?',
    correctPartner: REFERRAL_PAIRS['Young Driver'],
    why: 'The exercise directs a receptive new driver toward injury-prevention learning while motivation is high.',
  },
  {
    profile: 'Tired Driver',
    prompt: 'A shift worker has changed routes to stay alert, but fatigue risk remains and support needs to continue close to home. Which exercise partner best fits?',
    correctPartner: REFERRAL_PAIRS['Tired Driver'],
    why: 'Route changes do not resolve fatigue; the exercise uses local visibility and follow-up to sustain safer planning.',
  },
];

export function scenarioAt<T>(items: readonly T[], index: number): T {
  if (items.length === 0) throw new RangeError('Scenario pool must not be empty');
  const integer = Number.isFinite(index) ? Math.trunc(index) : 0;
  return items[((integer % items.length) + items.length) % items.length];
}
