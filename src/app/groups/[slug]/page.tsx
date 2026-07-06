import GroupPage, {
  generateMetadata as generateGroupMetadata,
} from "../../forum/[slug]/page";

export const dynamic = "force-dynamic";
export function generateMetadata(
  props: Parameters<typeof generateGroupMetadata>[0]
) {
  return generateGroupMetadata(props);
}
export default GroupPage;
