import type { NextConfig } from "next";

const [, repoOwner, repoName] = process.env.GITHUB_REPOSITORY?.match(/^([^/]+)\/(.+)$/) ?? [];
const isUserOrOrgPagesRepo = repoName === `${repoOwner}.github.io`;
const inferredGithubPagesBasePath =
  process.env.GITHUB_ACTIONS === "true" && repoName && !isUserOrOrgPagesRepo ? `/${repoName}` : "";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? inferredGithubPagesBasePath;
const isStaticExport = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  typedRoutes: false,
  output: isStaticExport ? "export" : undefined,
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: isStaticExport,
  images: {
    unoptimized: isStaticExport,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;
