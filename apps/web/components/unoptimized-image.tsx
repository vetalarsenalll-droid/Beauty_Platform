import Image, { type ImageProps } from "next/image";
import { forwardRef } from "react";

type UnoptimizedImageProps = Omit<ImageProps, "alt" | "height" | "width"> & {
  alt?: string;
  height?: number;
  width?: number;
};

export const UnoptimizedImage = forwardRef<HTMLImageElement, UnoptimizedImageProps>(
  function UnoptimizedImage({ alt = "", height = 800, width = 1200, ...props }, ref) {
    return <Image ref={ref} alt={alt} height={height} unoptimized width={width} {...props} />;
  }
);
