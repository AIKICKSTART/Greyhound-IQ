import GroupThreadPage, {
  generateMetadata as generateGroupThreadMetadata,
} from "../../../forum/threads/[id]/page";

export const dynamic = "force-dynamic";
export function generateMetadata(
  props: Parameters<typeof generateGroupThreadMetadata>[0]
) {
  return generateGroupThreadMetadata(props);
}
export default GroupThreadPage;
