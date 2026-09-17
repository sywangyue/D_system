import Placeholder from "@/components/layout/Placeholder"
import { getDict } from "@/lib/i18n"

/** 展会底图。服务端组件，直接取字典。 */
export default async function ExpoPage() {
  const t = await getDict()
  return <Placeholder t={t}
    title={t.expo.title}
    lat="Basemap"
    phase={t.expo.phase}
    items={[t.expo.item1, t.expo.item2, t.expo.item3, t.expo.item4]} />
}
