/** Next rewrites these when an app compiles the package. This is for `tsc` here. */
declare module "*.webp" {
  const image: { src: string; height: number; width: number }
  export default image
}

declare module "*.jpg" {
  const image: { src: string; height: number; width: number }
  export default image
}

declare module "*.png" {
  const image: { src: string; height: number; width: number }
  export default image
}

declare module "*.css" {
  const classes: { readonly [key: string]: string }
  export default classes
}
