## Math for `MusicAnalyzer.#getAdjustedDecayTime`

### Exponential Smoothing

The output of the windowed FFT on audio is noisy due to factors such as noise, vibrato,
and the effect of having a small window size. To combat this, we can employ exponential
smoothing, in which we update

$$
\hat y \leftarrow y + (\hat y - y) e^{-\Delta t/\lambda}
$$

where $\hat y$ is the smoothed data, $y$ is the measured signal, $\Delta t$ is the time
since the last measurement, and $\lambda$ is the time constant for decay. This is a good
approximation to the differential equation

$$\frac{ d\hat y }{dt} = \frac{y - \hat y}\lambda$$

Intuitively, this results in an exponentially decaying difference between the smoothed
signal and the measured signal.

However, we also have to account for smoothing caused by windowing, which causes the
"true" signal to be convolved with the windowing function, resulting in the measured
signal being smeared. This is important because the amount of smoothing caused by
windowing can be quite significant (up to 1.4 seconds on max resolution for a sample rate
of 48 kHz), which means that the same smoothing level can result in wildly different
levels of actual smoothing.

To adjust for windowing, we can shrink the smoothing time constant $\lambda$ by some
factor $\alpha$ so that the effects of exponential smoothing and windowing add up to be
the same as the non-windowed case.

### Calculating response to Windowing

To find what $\alpha$ should be, consider the simplest signal &mdash; a step function. Let
the true signal be
$$
y^*(t) = \begin{cases} 1 & t \le 0 \\ 0 & t > 0 \end{cases}
$$
It is easy to see that the response to this signal (without windowing) will be
$$
\hat y(t) = e^{-t/\lambda} \quad \text{for } t \ge 0
$$
and thus by linearity, the adjusted response to the windowed signal will be
$$
\hat y_{\alpha,L}(t) = \frac1L \int_0^L \hat y_\alpha(t - s) ds = \begin{cases}
(1 - t/L) + \rho(1 - e^{-\alpha t/\lambda}) & 0 \le t \le L \\
\rho e^{-\alpha t/\lambda} (e^{1/\rho} - 1) & t \ge L
\end{cases}
$$

where the subscript $\alpha$ indicates use of adjusted time constant $\lambda/\alpha$, $L$
is the window size, and $\rho = \frac{\lambda/\alpha} L$ is the ratio between the adjusted
time constant and the window size.

(We can intuitively think of the first terms of the $t \le L$ case as describing the ramp
in the measured signal caused by the windowing, and the second term describing the
smoothed signal "following" the ramp. The $t \ge L$ case is just pure exponential decay)

### Calculating $\alpha$

Although there is evidently no choice of $\alpha$ that would make $\hat y_{\alpha,L}(t)$
identical to $\hat y(t)$, we can still aim to make the two functions decay at
*approximately* the same rate by choosing $\alpha$ such that

$$\hat y_{\alpha,L}(\tau) = \hat y(\tau) = \varepsilon$$

where $\tau = -\lambda \log(\varepsilon)$ is the time that it takes for $\hat y$ to decay
to $\varepsilon$

Case 1 ($\tau \le L$):

- We want

  $$
  \begin{align*}
  \epsilon &= 1 - \frac\tau L + \rho(1 - e^{-\alpha\tau/\lambda}) \\
  &= 1 + \rho\alpha\log\varepsilon + \rho(1 - e^{\alpha \log \varepsilon}) \\
  &= 1 + \rho(1 + \alpha\log\epsilon - e^{\alpha \log \varepsilon}) \\[5pt]
  (\varepsilon-1)/\rho &= 1 + \alpha\log\epsilon - e^{\alpha \log \varepsilon} \\
  \end{align*}
  $$

  Now it looks like we can solve for $\alpha$ using Lambert W function shenanigans, but
  remember that $\rho$ is still in terms of $\alpha$. So we need to do a bit more
  simplification. Expanding out $\rho$ in terms of $\alpha$ and letting
  $x=\alpha\log\varepsilon$,
  $$
  \begin{align*}
  \frac{\alpha L}\lambda (\varepsilon-1) &= 1 + x - e^x
  \\[10pt]
  \frac{L (\varepsilon-1)}{\lambda \log \varepsilon} &= 1 + \frac{1 - e^x}x
  \\[10pt]
  \frac{e^x - 1}x &= 1 - \frac{L(1 - \varepsilon)}\tau
  \end{align*}
  $$

  Now we can solve for $x$ and thus $\alpha$. Let $c$ be the reciprocal of the right hand
  side. Then we need to solve $e^x = 1 + x/c$, which has the solution
  $x = -c W(-ce^{-c})$, or

  $$\alpha = -\frac 1{\log \varepsilon}(c + W(-ce^{-c}))$$

  This concludes the $\tau < L$ case. (Intuitively, the $1-\varepsilon$ in $c$ represents
  the change necessary to get to $\varepsilon$ and the $L/\tau$ represents the ratio of
  the size of the window to the desired time to decay)

Case 2 ($\tau \ge L$):

- This case is much harder, and has no analytical solution even with the Lambert W
  function. Instead, we can try root finding methods:
  $$
  \begin{align*}
  \epsilon &= \rho e^{-\alpha\tau/\lambda} (e^{1/\rho} - 1)
  \\
  &= \rho e^{\alpha \log \varepsilon} (e^{1/\rho} - 1)
  \\[5pt]
  (\varepsilon / \rho) \varepsilon^{-\alpha} &= e^{1/\rho} - 1
  \\[5pt]
  0 = f(\alpha) &= 
  1 + (1/\rho) \varepsilon^{1-\alpha} - e^{1/\rho}
  \end{align*} 
  $$
  
  With a little bit of work it can be shown that the $\alpha$ will be bounded above by
  $$\alpha_0 = \frac{e^{-1/\varepsilon} - 1}{\varepsilon \log \varepsilon}$$
  at which $f$ is nonnegative, and below by $\lambda$ at which $f$ is negative. These can
  be used as the starting interval for a root finding method such as the bisection method
  or secant method.

See [this graph in Desmos](https://www.desmos.com/calculator/vqjtmnpriw) to play around 
with this stuff.