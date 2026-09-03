import type { IconType } from "react-icons"
import {
  RiFacebookCircleLine,
  RiGlobalLine,
  RiInstagramLine,
  RiLinkedinBoxLine,
  RiPinterestLine,
  RiTiktokLine,
  RiTwitterXLine,
  RiYoutubeLine,
} from "react-icons/ri"
import type { DigitalChannelType } from "@/lib/leads/digital-channels"

export const CHANNEL_ICONS: Record<DigitalChannelType, IconType> = {
  website: RiGlobalLine,
  instagram: RiInstagramLine,
  linkedin: RiLinkedinBoxLine,
  facebook: RiFacebookCircleLine,
  youtube: RiYoutubeLine,
  tiktok: RiTiktokLine,
  pinterest: RiPinterestLine,
  twitter: RiTwitterXLine,
}
