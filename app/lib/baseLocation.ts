// Where every truck starts.
//
// The fleet keeps one yard, so every trip begins at the same place. That is
// worth more than it sounds: it is the difference between "can this itinerary
// be driven" and "can this itinerary be driven starting from somewhere we
// actually know", which is what decides whether a crew can reach the first
// stop at the hour it was promised for.
//
// Without it the feasibility check could only look at the gap between the first
// stop and the last and stay silent about getting to the first one at all,
// because the truck could have been anywhere. It cannot be anywhere. It is
// here.
//
// If the yard moves, this is the only line to change - and it is worth checking
// against a map when it does, because every booking is measured from it.
//
// The coordinates are the centre of the plus code's own cell, so they can be
// checked without trusting this comment: H2X6+58 Santa Mesa decodes to a square
// about fourteen metres across, and these are its middle.

import type { Coordinates } from "@/services/geo/geocodingService";

export const BASE_LOCATION: Coordinates & {
  label: string;
  address: string;
  plusCode: string;
} = {
  label: "the yard",
  address: "1016 Anonas Street, Sta. Mesa, Manila",
  plusCode: "H2X6+58 Santa Mesa, Manila",
  latitude: 14.59794,
  longitude: 121.01081,
};

/**
 * How long the crew need before the wheels turn.
 *
 * Checking the truck, signing out, getting through the gate. Not the drive -
 * that is measured - but the part that is the same wherever they are going and
 * that nobody schedules.
 */
export const DEPARTURE_BUFFER_MIN = 30;
