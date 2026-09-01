import React from 'react';
import BusinessIcon from '@mui/icons-material/Business';

interface OrgLogoProps {
    src?: string | null;
    alt?: string;
    className?: string;          // Standard classes that apply to both image and fallback container
    fallbackClassName?: string;  // Classes specific to the fallback container when no image
    iconClassName?: string;      // Classes specific to the material icon inside the fallback
    iconSize?: 'inherit' | 'large' | 'medium' | 'small';
}

export default function OrgLogo({
    src,
    alt = "Organization Logo",
    className = "w-10 h-10 rounded-lg border border-border",
    fallbackClassName = "bg-secondaryBg flex items-center justify-center",
    iconClassName = "text-textSecondary",
    iconSize = "small"
}: OrgLogoProps) {
    if (src) {
        return (
            <img
                src={src}
                alt={alt}
                className={`object-cover ${className}`}
            />
        );
    }

    return (
        <div className={`${className} ${fallbackClassName}`}>
            <BusinessIcon fontSize={iconSize} className={iconClassName} />
        </div>
    );
}
