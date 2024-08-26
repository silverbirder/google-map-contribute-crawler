export type Contributor = {
  name: string;
  url: string;
  profileImageUrl: string;
  contributorId: string;
} | null;

export type Place = {
  name: string;
  url: string;
  profileImageUrl: string;
  address: string;
};

export type Review = {
  contributorId: string;
  reviewId: string;
  place: Place;
  url: string;
};
