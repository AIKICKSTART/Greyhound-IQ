import PulseThreadPage, {
  generateMetadata as generatePulseMetadata,
} from "../../messages/[id]/page";

export const dynamic = "force-dynamic";
export function generateMetadata(
  props: Parameters<typeof generatePulseMetadata>[0]
) {
  return generatePulseMetadata(props);
}
export default PulseThreadPage;
