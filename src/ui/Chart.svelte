<script lang="ts">
  import * as echarts from 'echarts';

  let { option, height = 220 }: { option: echarts.EChartsOption; height?: number } = $props();
  let el: HTMLDivElement;

  $effect(() => {
    const chart = echarts.init(el, undefined, { renderer: 'canvas' });
    chart.setOption(option);
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
    };
  });
</script>

<div bind:this={el} style="height: {height}px; width: 100%;"></div>
