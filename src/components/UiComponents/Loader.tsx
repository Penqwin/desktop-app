interface LoaderProps {
  size?: number;
}

export default function Loader({ size = 32 }: LoaderProps) {

  return (
    <div className="flex w-full items-center justify-center">
      <div className="animate-spin rounded-full border-b-2 border-t-2 border-primary"
        style={{
          height: `${size}px`,
          width: `${size}px`
        }}></div>
    </div>
  );
};
