const nextConfig = {
  output: "export",
  basePath: process.env.NODE_ENV === "production" ? "/page-games" : "",
  trailingSlash: true,

  images: {
    unoptimized: true,
  },
};

export default nextConfig;
