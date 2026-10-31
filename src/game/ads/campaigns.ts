export type CampaignStatus = 'draft' | 'placeholder' | 'approved' | 'ended';

export interface Campaign {
  id: string;
  advertiser: string;
  name: string;
  status: CampaignStatus;
  starts: string;
  ends: string;
  placementId: string;
  headline: string;
  body: string;
  label: 'Sponsored';
}

/** Local placeholder inventory. Nothing here is a paid or approved campaign. */
export const CAMPAIGNS: Campaign[] = [
  {
    id: 'preview-street-board',
    advertiser: 'NairobiDiaries Studio',
    name: 'Preview street board',
    status: 'placeholder',
    starts: '2026-01-01',
    ends: '2026-12-31',
    placementId: 'cbd-road-board',
    headline: 'Your brand, on the street',
    body: 'Placeholder creative. No payment, invoice, or delivery is happening.',
    label: 'Sponsored',
  },
];

export function liveCampaigns(now = new Date()): Campaign[] {
  const day = now.toISOString().slice(0, 10);
  return CAMPAIGNS.filter(
    (campaign) =>
      (campaign.status === 'placeholder' || campaign.status === 'approved') &&
      campaign.starts <= day &&
      campaign.ends >= day,
  );
}
