import { notFound } from "next/navigation"
import { ShowcaseCategory } from "@/components/custom/Showcase/ShowcaseCategory"
import { isShowcaseCategory } from "@/components/custom/Showcase/showcase-registry"

export default async function ShowcaseCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  if (!isShowcaseCategory(category)) notFound()
  return <ShowcaseCategory category={category} />
}
