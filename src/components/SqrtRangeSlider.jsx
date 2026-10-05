import React from "react";
import { Range } from "react-range";

export const SqrtRange = (props) => {
  const {
    minValue,
    maxValue,
    onChange,
    max,
    step,
    StyledTrack,
    StyledThumb,
  } = props;
  const sqrtMax = Math.sqrt(max);

  // Ensure the slider's max is a multiple of `step`
  const sliderMax = React.useMemo(() => {
    if (!step) return sqrtMax;
    const nSteps = Math.floor(sqrtMax / step);
    return nSteps > 0 ? nSteps * step : sqrtMax;
  }, [sqrtMax, step]);

  // Compute sqrt values and snap them to the [0, sliderMax] step grid
  const sqrtValues = React.useMemo(() => {
    const snapToStep = (v) => {
      if (!step) return v;

      const snapped = Math.round(v / step) * step;
      const clamped = Math.min(Math.max(snapped, 0), sliderMax);
      return clamped;
    };

    const minSqrt = snapToStep(Math.sqrt(minValue));
    const maxSqrt = snapToStep(Math.sqrt(maxValue));

    return [minSqrt, maxSqrt];
  }, [minValue, maxValue, step, sliderMax]);

  return (
    <Range
      min={0}
      max={sliderMax}
      step={step}
      values={sqrtValues}
      onChange={([minS, maxS]) => {
        onChange({
          min: Math.pow(minS, 2),
          max: Math.pow(maxS, 2),
        });
      }}
      renderTrack={({ props, children, index }) => {
        const { ...rest } = props;

        const [curMinS, curMaxS] = sqrtValues;
        const minPct =
          sliderMax > 0 ? (curMinS / sliderMax) * 100 : 0;
        const maxPct =
          sliderMax > 0 ? (curMaxS / sliderMax) * 100 : 0;

        return (
          <StyledTrack
            key={index}
            props={rest}
            minPct={minPct}
            maxPct={maxPct}
          >
            {children}
          </StyledTrack>
        );
      }}
      renderThumb={({ props, index }) => {
        const { ...rest } = props;
        return <StyledThumb key={index} props={rest} />;
      }}
    />
  );
};
