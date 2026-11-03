import { CameraWall } from '../CameraWall';

// Latest snapshot from each of this yacht's cameras, uploaded by the ORION M5 Tough.
export function SecurityCamerasTab({ yachtId }: { yachtId: string }) {
  return <CameraWall yachtId={yachtId} embedded />;
}
