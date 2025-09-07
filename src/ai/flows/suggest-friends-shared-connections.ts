 'use server';
/**
 * @fileOverview AI agent that suggests new friends based on shared connections.
 *
 * - suggestFriendsSharedConnections - A function that suggests new friends based on shared connections.
 * - SuggestFriendsSharedConnectionsInput - The input type for the suggestFriendsSharedConnections function.
 * - SuggestFriendsSharedConnectionsOutput - The return type for the suggestFriendsSharedConnections function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestFriendsSharedConnectionsInputSchema = z.object({
  userUid: z.string().describe('The user ID for whom to suggest friends.'),
  contacts: z.array(z.string()).describe('The list of user IDs that the current user has as contacts.'),
  allUsers: z.record(z.object({
    uid: z.string(),
    name: z.string(),
    username: z.string(),
  })).describe('A record of all users in the database, keyed by their user ID.'),
});

export type SuggestFriendsSharedConnectionsInput = z.infer<
  typeof SuggestFriendsSharedConnectionsInputSchema
>;

const SuggestFriendsSharedConnectionsOutputSchema = z.array(z.object({
  uid: z.string().describe('The user ID of the suggested friend.'),
  name: z.string().describe('The name of the suggested friend.'),
  username: z.string().describe('The username of the suggested friend.'),
  sharedContacts: z.array(z.string()).describe('List of user IDs that are shared contacts with the current user'),
})).describe('A list of suggested friends with shared connections.');

export type SuggestFriendsSharedConnectionsOutput = z.infer<
  typeof SuggestFriendsSharedConnectionsOutputSchema
>;

export async function suggestFriendsSharedConnections(
  input: SuggestFriendsSharedConnectionsInput
): Promise<SuggestFriendsSharedConnectionsOutput> {
  return suggestFriendsSharedConnectionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestFriendsSharedConnectionsPrompt',
  input: {schema: SuggestFriendsSharedConnectionsInputSchema},
  output: {schema: SuggestFriendsSharedConnectionsOutputSchema},
  prompt: `You are an expert at suggesting friends based on existing connections.

  Given a user and their existing contacts, analyze all other users in the system to suggest new friends for the user based on shared connections.

  Consider the following:
  - A good friend suggestion is someone who shares multiple connections with the user.
  - Only suggest users who are not already contacts of the user.
  - Return the list of shared contact user IDs for each suggested friend.

  User ID: {{{userUid}}}
  User Contacts: {{contacts}}
  All Users: {{allUsers}}

  Format your response as a JSON array of objects. Each object should contain the uid, name, username, and sharedContacts (array of uids) of the suggested friend.
  `,
});

const suggestFriendsSharedConnectionsFlow = ai.defineFlow(
  {
    name: 'suggestFriendsSharedConnectionsFlow',
    inputSchema: SuggestFriendsSharedConnectionsInputSchema,
    outputSchema: SuggestFriendsSharedConnectionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
