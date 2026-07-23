export {
  createPinnedReplayFetch as createPublicInternetFetch,
  createPublicAddressLookup,
  fetchPinnedReplayOrigin as fetchPublicInternetOrigin,
  isPublicInternetAddress,
  resolveReplayAddresses as resolvePublicInternetAddresses,
  type ReplayAddressResolver as PublicAddressResolver,
  type ReplayResolvedAddress as PublicResolvedAddress,
} from "@/lib/live/replay-network";
