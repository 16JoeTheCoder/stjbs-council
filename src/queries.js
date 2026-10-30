// Queries used by more than one module. Each has its composite index in firestore.indexes.json.
import { collection, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { addDays } from './time.js';

// The bounded event window: a week back for "what just happened", 60 days ahead for planning.
export const EVENT_BACK_DAYS = 7, EVENT_AHEAD_DAYS = 60;
export const eventsQuery = (termId, day, from = addDays(day, -EVENT_BACK_DAYS), to = addDays(day, EVENT_AHEAD_DAYS)) =>
  query(collection(db, 'events'), where('termId', '==', termId), where('archived', '==', false),
    where('date', '>=', from), where('date', '<=', to), orderBy('date'));
export const announcementsQuery = (termId, day) =>
  query(collection(db, 'announcements'), where('termId', '==', termId), where('archived', '==', false), where('endDate', '>=', day));
