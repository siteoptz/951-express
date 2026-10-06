export type RouteConfig = {
  id: string;
  name: string;
  originStates: string[];
  destStates: string[];
  weeklyCapacity: number;
};

// Each direction is its own route. TODO(client): confirm corridors and capacity.
export const routes: RouteConfig[] = [
  {
    id: 'west-to-tx',
    name: 'West Coast → Texas',
    originStates: ['CA', 'NV', 'AZ', 'OR', 'WA', 'UT', 'ID', 'NM', 'CO'],
    destStates: ['TX'],
    weeklyCapacity: 12,
  },
  {
    id: 'tx-to-west',
    name: 'Texas → West Coast',
    originStates: ['TX'],
    destStates: ['CA', 'NV', 'AZ', 'OR', 'WA', 'UT', 'ID', 'NM', 'CO'],
    weeklyCapacity: 12,
  },
];
