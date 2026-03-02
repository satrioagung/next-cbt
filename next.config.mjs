/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        // ESLint errors won't fail the production build
        ignoreDuringBuilds: true,
    },
    typescript: {
        // TypeScript errors won't fail the production build
        ignoreBuildErrors: true,
    },
}

export default nextConfig