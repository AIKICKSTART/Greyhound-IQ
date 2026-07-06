import ListingDetailPage, {
  generateMetadata as generateListingMetadata,
} from "../../listings/[id]/page";

export const dynamic = "force-dynamic";
export function generateMetadata(
  props: Parameters<typeof generateListingMetadata>[0]
) {
  return generateListingMetadata(props);
}
export default ListingDetailPage;
